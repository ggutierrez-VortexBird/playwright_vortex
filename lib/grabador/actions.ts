/**
 * Server Action orquestadora para iniciar una sesión de grabación.
 *
 * Flujo (HU-G1):
 *   1. Validar input y requireProyectoAccess(session, proyectoId)
 *   2. (fusionado con el paso 1)
 *   3. Verificar credencial pertenece al proyecto (solo si se envió una)
 *   4. Crear SesionGrabacion estado='iniciando'
 *   5. POST /internal/start al recorder-worker
 *   6. UPDATE SesionGrabacion SET token=...
 *   7. Retornar {sessionId, wsUrl, token}
 *
 * Errores se mapean a {status, body} para que route handlers los traduzcan a HTTP.
 */
import { prisma } from "@/lib/db";
import { requireProyectoAccess, type SessionData } from "@/lib/auth";
import { decryptCredencial } from "@/lib/credenciales/crypto";
import {
  callInternalStart,
  RecorderMaxSessionsError,
  RecorderUnavailableError,
} from "./recorder-client";
import type { NuevaGrabacionInput, SesionGrabacionOut } from "./types";

// Cuánto esperamos (como máximo) a que el worker corra el caso padre antes
// de darlo por fallido. El worker sondea la BD cada POLL_INTERVAL_MS
// (scripts/worker.ts), así que este timeout debe cubrir esa latencia +
// el tiempo real de un login automatizado.
const PARENT_CASE_TIMEOUT_MS = 90_000;
const PARENT_CASE_POLL_MS = 1_500;

/**
 * Ejecuta un caso padre (login) ANTES de iniciar la grabación, encolándolo
 * como una Ejecucion normal para que lo corra scripts/worker.ts — el mismo
 * proceso separado que ya corre las ejecuciones reales. Deliberadamente NO
 * se importa nada de `lib/worker/**` acá: ese código hace `spawn` de
 * Playwright y next/turbopack no puede empaquetarlo dentro del proceso web
 * (rompía con "Module not found" al intentar resolver el path del CLI).
 */
async function runParentCaseAndGetStorageState(
  parentCaseId: string,
  proyectoId: string,
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

  const parentEjecucion = await prisma.ejecucion.create({
    data: { casoPruebaId: parentCaseId, estado: "pendiente" },
  });

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
          message: "El caso padre no generó storageState. Asegurate de que el caso de login persista la sesión.",
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
// HU-G34: tres navegadores soportados por Playwright. Chromium default;
// firefox/webkit quedan disponibles por preferencia del usuario. La
// columna `navegador` en DB es String libre; esta lista es solo la guard.
const VALID_NAVEGADORES = ["chromium", "firefox", "webkit"] as const;

function validate(input: NuevaGrabacionInput): void {
  if (!input.nombre || input.nombre.trim() === "") {
    throw {
      status: 400,
      body: { error: "validation", message: "nombre es requerido" },
    };
  }
  // URL validation: debe ser http o https
  try {
    const url = new URL(input.urlInicial);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("protocol");
    }
  } catch {
    throw {
      status: 400,
      body: { error: "validation", message: "urlInicial debe ser http o https" },
    };
  }
  if (!VALID_AMBIENTES.includes(input.ambiente as typeof VALID_AMBIENTES[number])) {
    throw {
      status: 400,
      body: { error: "validation", message: `ambiente debe ser uno de: ${VALID_AMBIENTES.join(", ")}` },
    };
  }
  if (!VALID_NAVEGADORES.includes(input.navegador as typeof VALID_NAVEGADORES[number])) {
    throw {
      status: 400,
      body: { error: "validation", message: `navegador debe ser uno de: ${VALID_NAVEGADORES.join(", ")}` },
    };
  }
  if (!input.proyectoId) {
    throw {
      status: 400,
      body: { error: "validation", message: "proyectoId es requerido" },
    };
  }
}

export async function iniciarSesionGrabacion(
  input: NuevaGrabacionInput,
  session: SessionData,
): Promise<SesionGrabacionOut> {
  // 1. Auth: superadmin, admin del espacio, o tester con acceso al proyecto
  validate(input);
  await requireProyectoAccess(session, input.proyectoId);

  // 3. La credencial es OPCIONAL: si viene una, se valida que pertenezca al
  //    proyecto. El storageState resultante se aplica al navegador del grabador.
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

  // 4. Descifrar storageState de credencial (best-effort)
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

  // 4b. HU-PARENT: si eligió un caso padre, lo ejecutamos ANTES de crear la
  // sesión para arrancar el grabador ya autenticado. El storageState del padre
  // tiene prioridad sobre el de la credencial.
  if (input.parentCaseId) {
    try {
      storageState = await runParentCaseAndGetStorageState(input.parentCaseId, input.proyectoId);
    } catch (err: any) {
      // Propagar el error con status/body si ya viene formateado
      if (err.status && err.body) {
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
      // Marcar la sesión como error para no dejarla huérfana
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