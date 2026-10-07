import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperadmin, type SessionData } from "@/lib/auth";
import { AppError } from "@/lib/http/errors";
import { encryptCredencial } from "./crypto";

export interface CredencialResumen {
  id: string;
  nombre: string;
  tipo: string;
  vence: string | null;
  creada: string;
  proyecto: { id: string; nombre: string; espacio: string };
  /** Casos cuya última grabación usó esta credencial: se ejecutan con su sesión. */
  casosQueLaUsan: number;
}

const storageStateSchema = z.object({
  cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string() }).passthrough()),
  origins: z.array(z.object({ origin: z.string() }).passthrough()),
});

export const nuevaCredencialSchema = z.object({
  proyectoId: z.string().uuid("Elige un proyecto"),
  nombre: z.string().trim().min(1, "Escribe un nombre").max(80, "Máximo 80 caracteres"),
  storageState: z.string().min(1, "Pega el storageState o carga el archivo"),
  vence: z.string().optional().nullable(),
});

export type NuevaCredencialInput = z.infer<typeof nuevaCredencialSchema>;

/** Valida que el texto sea un storageState de Playwright; devuelve el JSON normalizado o el motivo del rechazo. */
export function validarStorageState(texto: string): { ok: true; json: string } | { ok: false; error: string } {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, error: "No es un JSON válido." };
  }
  const r = storageStateSchema.safeParse(datos);
  if (!r.success) return { ok: false, error: "Debe ser un storageState de Playwright: un objeto con listas `cookies` y `origins`." };
  return { ok: true, json: JSON.stringify(r.data) };
}

export async function listarCredenciales(session: SessionData): Promise<CredencialResumen[]> {
  await requireSuperadmin(session);
  const filas = await prisma.credencial.findMany({
    orderBy: [{ proyecto: { nombre: "asc" } }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      tipo: true,
      sesionVenceAt: true,
      createdAt: true,
      proyecto: { select: { id: true, nombre: true, espacio: { select: { nombre: true } } } },
      sesiones: { where: { casoPruebaId: { not: null } }, select: { casoPruebaId: true }, distinct: ["casoPruebaId"] },
    },
  });
  return filas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    vence: c.sesionVenceAt?.toISOString() ?? null,
    creada: c.createdAt.toISOString(),
    proyecto: { id: c.proyecto.id, nombre: c.proyecto.nombre, espacio: c.proyecto.espacio.nombre },
    casosQueLaUsan: c.sesiones.length,
  }));
}

export async function crearCredencial(session: SessionData, entrada: unknown): Promise<{ id: string }> {
  await requireSuperadmin(session);
  const r = nuevaCredencialSchema.safeParse(entrada);
  if (!r.success) {
    const campo = r.error.issues[0];
    throw new AppError(400, `validation:${String(campo?.path[0] ?? "")}`, campo?.message ?? "Datos inválidos");
  }
  const estado = validarStorageState(r.data.storageState);
  if (!estado.ok) throw new AppError(400, "validation:storageState", estado.error);

  const proyecto = await prisma.proyecto.findUnique({ where: { id: r.data.proyectoId }, select: { id: true } });
  if (!proyecto) throw new AppError(400, "validation:proyectoId", "El proyecto ya no existe");

  const repetida = await prisma.credencial.findFirst({ where: { proyectoId: proyecto.id, nombre: r.data.nombre }, select: { id: true } });
  if (repetida) throw new AppError(409, "validation:nombre", "Ya hay una credencial con ese nombre en el proyecto");

  const vence = r.data.vence ? new Date(r.data.vence) : null;
  if (vence && Number.isNaN(vence.getTime())) throw new AppError(400, "validation:vence", "Fecha de vencimiento inválida");

  const creada = await prisma.credencial.create({
    data: {
      proyectoId: proyecto.id,
      nombre: r.data.nombre,
      tipo: "storageState",
      valor: new Uint8Array(encryptCredencial(estado.json)),
      sesionVenceAt: vence,
    },
    select: { id: true },
  });
  return creada;
}

export async function eliminarCredencial(session: SessionData, id: string): Promise<void> {
  await requireSuperadmin(session);
  const r = await prisma.credencial.deleteMany({ where: { id } });
  if (r.count === 0) throw new AppError(404, "not_found", "La credencial ya no existe");
}
