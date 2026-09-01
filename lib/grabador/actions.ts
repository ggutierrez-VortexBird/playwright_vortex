/**
 * Server Action orquestadora para iniciar una sesión de grabación.
 *
 * Flujo (HU-G1):
 *   1. requireSuperadmin(session)
 *   2. Validar input
 *   3. Verificar credencial pertenece al proyecto
 *   4. Crear SesionGrabacion estado='iniciando'
 *   5. POST /internal/start al recorder-worker
 *   6. UPDATE SesionGrabacion SET token=...
 *   7. Retornar {sessionId, wsUrl, token}
 *
 * Errores se mapean a {status, body} para que route handlers los traduzcan a HTTP.
 */
import { prisma } from "@/lib/db";
import { requireSuperadmin, type SessionData } from "@/lib/auth";
import { decryptCredencial } from "@/lib/credenciales/crypto";
import {
  callInternalStart,
  RecorderMaxSessionsError,
  RecorderUnavailableError,
} from "./recorder-client";
import type { NuevaGrabacionInput, SesionGrabacionOut } from "./types";

const VALID_AMBIENTES = ["QA", "Staging", "Prod"] as const;
const VALID_NAVEGADORES = ["chromium"] as const;

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
  if (!input.credencialId || !input.proyectoId) {
    throw {
      status: 400,
      body: { error: "validation", message: "credencialId y proyectoId son requeridos" },
    };
  }
}

export async function iniciarSesionGrabacion(
  input: NuevaGrabacionInput,
  session: SessionData,
): Promise<SesionGrabacionOut> {
  // 1. Auth
  await requireSuperadmin(session);

  // 2. Validation
  validate(input);

  // 3. Credencial debe pertenecer al proyecto
  const credencial = await prisma.credencial.findFirst({
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

  // 4. Descifrar storageState (best-effort: si falla, asumimos vacío)
  let storageState: unknown = null;
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

  // 5. Crear SesionGrabacion
  const sesion = await prisma.sesionGrabacion.create({
    data: {
      proyectoId: input.proyectoId,
      usuarioId: session.userId!,
      nombre: input.nombre.trim(),
      urlInicial: input.urlInicial,
      ambiente: input.ambiente,
      navegador: input.navegador,
      credencialId: input.credencialId,
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