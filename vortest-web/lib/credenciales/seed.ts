/**
 * Crea una Credencial de muestra (storageState vacío para `about:blank`)
 * que permite que el demo funcione out-of-the-box sin requerir credenciales
 * reales. Es idempotente: si ya existe una Credencial con el mismo nombre
 * en el proyecto, retorna la existente sin duplicarla.
 */
import { prisma } from "@/lib/db";
import { encryptCredencial } from "./crypto";

const DEMO_NOMBRE = "Demo QA";
const DEMO_TIPO = "storageState";
const DEMO_STORAGE_STATE = JSON.stringify({ cookies: [], origins: [] });

export interface CredencialDemo {
  id: string;
  proyectoId: string;
  nombre: string;
  tipo: string;
  valor: Buffer;
  sesionVenceAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function seedCredencialDemo(proyectoId: string): Promise<CredencialDemo> {
  const existing = await prisma.credencial.findFirst({
    where: { proyectoId, nombre: DEMO_NOMBRE },
  });
  if (existing) {
    return existing as CredencialDemo;
  }

  // W4 — Prisma 6 + Node 22 type narrowing fix: Buffer (Uint8Array<ArrayBufferLike>)
  // no es asignable a Uint8Array<ArrayBuffer>. Prisma espera el genérico
  // estricto con ArrayBuffer; Buffer's underlying storage es ArrayBufferLike.
  // Cast explícito (la memoria subyacente es la misma — solo difiere el genérico).
  const ciphertext = encryptCredencial(DEMO_STORAGE_STATE);
  return (await prisma.credencial.create({
    data: {
      proyectoId,
      nombre: DEMO_NOMBRE,
      tipo: DEMO_TIPO,
      valor: ciphertext as unknown as Uint8Array<ArrayBuffer>,
    },
  })) as CredencialDemo;
}