/** Server Action que inicia una sesión de grabación: valida, crea SesionGrabacion, llama al recorder-worker y devuelve {sessionId, wsUrl, token}. */
import { prisma } from "@/lib/db";
import { requireProyectoAccess, type SessionData } from "@/lib/auth";
import { decryptCredencial } from "@/lib/credenciales/crypto";
import {
  callInternalStart,
  RecorderMaxSessionsError,
  RecorderUnavailableError,
} from "./recorder-client";
import type { NuevaGrabacionInput, SesionGrabacionOut } from "./types";
import { publishExecuteJob } from "@/lib/queue/rabbitmq";
import { buildExecuteJob, markPublishFailed, storageStateDeCredencialDelCaso } from "@/lib/ejecuciones/dispatch";

// Cubre la ejecución completa del login automatizado en el motor; el despacho ya es inmediato por RabbitMQ.
const PARENT_CASE_TIMEOUT_MS = 90_000;
const PARENT_CASE_POLL_MS = 1_500;

/** Ejecuta el caso padre (login) en el motor ANTES de grabar y devuelve su storageState, para arrancar el grabador ya autenticado. */
async function runParentCaseAndGetStorageState(
  parentCaseId: string,
  proyectoId: string,
  navegador: string,
): Promise<unknown> {
  const parentCase = await prisma.casoPrueba.findUnique({
    where: { id: parentCaseId },
  });

  if (!parentCase) {
    throw { status: 400, body: { error: "validation", message: "Caso padre no encontrado" } };
  }
  if (parentCase.proyectoId !== proyectoId) {
    throw { status: 400, body: { error: "validation", message: "El caso padre debe pertenecer al mismo proyecto" } };
  }
  if (!parentCase.activo) {
    throw { status: 400, body: { error: "validation", message: "El caso padre está inactivo" } };
  }

  // Hay que publicar el job; si no, nadie ejecuta la fila 'pendiente'.
  const parentEjecucion = await prisma.ejecucion.create({
    data: { casoPruebaId: parentCaseId, estado: "corriendo", inicioAt: new Date(), navegador },
  });
  try {
    await publishExecuteJob(
      buildExecuteJob({
        jobId: parentEjecucion.id,
        script: parentCase.script,
        scriptFileName: parentCase.scriptFileName,
        inputStorageState: await storageStateDeCredencialDelCaso(parentCaseId),
        navegador,
      }),
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markPublishFailed(parentEjecucion.id, detail, err);
    throw { status: 503, body: { error: "parent_failed", message: `No se pudo encolar el caso padre: ${detail}` } };
  }

  const deadline = Date.now() + PARENT_CASE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, PARENT_CASE_POLL_MS));
    const current = await prisma.ejecucion.findUnique({ where: { id: parentEjecucion.id } });
    if (!current) break;
    if (current.estado === "pendiente" || current.estado === "corriendo") continue;

    if (current.estado !== "paso") {
      throw {
        status: 400,
        body: {
          error: "parent_failed",
          message: `El caso padre falló (${current.estado}): ${current.errorMsg || "sin mensaje"}`,
        },
      };
    }
    if (!current.storageState) {
      throw {
        status: 400,
        body: {
          error: "parent_no_state",
          message: "El caso padre terminó sin guardar la sesión. Revisa que el caso de login termine con la sesión iniciada.",
        },
      };
    }
    return current.storageState;
  }

  throw {
    status: 504,
    body: { error: "parent_timeout", message: "El caso padre no terminó a tiempo" },
  };
}

const VALID_AMBIENTES = ["QA", "Staging", "Prod"] as const;
// Navegadores soportados por Playwright (chromium por defecto); la columna en DB es String libre, esta lista es solo la guard.
const VALID_NAVEGADORES = ["chromium", "firefox", "webkit"] as const;

function validate(input: NuevaGrabacionInput): void {
  if (!input.nombre || input.nombre.trim() === "") {
    throw {
      status: 400,
      body: { error: "validation", message: "Escribe un nombre para la grabación" },
    };
  }
  // Validación de URL: debe ser http o https
  try {
    const url = new URL(input.urlInicial);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("protocol");
    }
  } catch {
    throw {
      status: 400,
      body: { error: "validation", message: "La URL inicial debe empezar por http:// o https://" },
    };
  }
  if (!VALID_AMBIENTES.includes(input.ambiente as typeof VALID_AMBIENTES[number])) {
    throw {
      status: 400,
      body: { error: "validation", message: `Elige un ambiente: ${VALID_AMBIENTES.join(", ")}` },
    };
  }
  if (!VALID_NAVEGADORES.includes(input.navegador as typeof VALID_NAVEGADORES[number])) {
    throw {
      status: 400,
      body: { error: "validation", message: `Elige un navegador: ${VALID_NAVEGADORES.join(", ")}` },
    };
  }
  if (!input.proyectoId) {
    throw {
      status: 400,
      body: { error: "validation", message: "Elige un proyecto" },
    };
  }
}

export async function iniciarSesionGrabacion(
  input: NuevaGrabacionInput,
  session: SessionData,
): Promise<SesionGrabacionOut> {
  // 1. Auth: superadmin, admin del espacio o tester con acceso al proyecto
  validate(input);
  await requireProyectoAccess(session, input.proyectoId);

  // 3. La credencial es opcional; si viene, debe pertenecer al proyecto y su storageState se aplica al navegador.
  let credencial = null;
  if (input.credencialId) {
    credencial = await prisma.credencial.findFirst({
      where: { id: input.credencialId, proyectoId: input.proyectoId },
    });
    if (!credencial) {
      throw {
        status: 400,
        body: {
          error: "validation",
          message: "credencial no pertenece al proyecto",
        },
      };
    }
  }

  // 4. Descifrar el storageState de la credencial (best-effort)
  let storageState: unknown = null;
  if (credencial) {
    try {
      const plain = decryptCredencial(credencial.valor as Buffer);
      try {
        storageState = JSON.parse(plain);
      } catch {
        storageState = null;
      }
    } catch {
      storageState = null;
    }
  }

  // 4b. Si eligió un caso padre se ejecuta antes de crear la sesión; su storageState tiene prioridad sobre el de la credencial.
  if (input.parentCaseId) {
    try {
      storageState = await runParentCaseAndGetStorageState(input.parentCaseId, input.proyectoId, input.navegador);
    } catch (err) {
      // Propaga el error si ya viene con status/body
      const formateado = err as { status?: number; body?: unknown };
      if (formateado?.status && formateado.body) {
        throw err;
      }
      throw {
        status: 500,
        body: {
          error: "parent_execution_error",
          message: err instanceof Error ? err.message : "Error ejecutando caso padre",
        },
      };
    }
  }

  // 5. Crear SesionGrabacion
  const sesion = await prisma.sesionGrabacion.create({
    data: {
      proyectoId: input.proyectoId,
      usuarioId: session.userId!,
      nombre: input.nombre.trim(),
      urlInicial: input.urlInicial,
      ambiente: input.ambiente,
      navegador: input.navegador,
      credencialId: input.credencialId || null,
      parentCaseId: input.parentCaseId || null,
      estado: "iniciando",
    },
  });

  // 6. Llamar al recorder-worker
  let startResult: { token: string; wsUrl: string };
  try {
    startResult = await callInternalStart({
      sessionId: sesion.id,
      userId: session.userId!,
      urlInicial: input.urlInicial,
      storageState,
      navegador: input.navegador,
    });
  } catch (err: unknown) {
    if (err instanceof RecorderMaxSessionsError) {
      // Marca la sesión como error para no dejarla huérfana
      await prisma.sesionGrabacion.update({
        where: { id: sesion.id },
        data: { estado: "error", mensajeError: err.message },
      });
      throw {
        status: 503,
        body: { error: "max_sessions", message: err.message },
      };
    }
    if (err instanceof RecorderUnavailableError) {
      await prisma.sesionGrabacion.update({
        where: { id: sesion.id },
        data: { estado: "error", mensajeError: err.message },
      });
      throw {
        status: 503,
        body: { error: "recorder_unavailable", message: err.message },
      };
    }
    throw err;
  }

  // 7. Persistir token
  await prisma.sesionGrabacion.update({
    where: { id: sesion.id },
    data: { token: startResult.token },
  });

  return {
    sessionId: sesion.id,
    wsUrl: startResult.wsUrl,
    token: startResult.token,
  };
}