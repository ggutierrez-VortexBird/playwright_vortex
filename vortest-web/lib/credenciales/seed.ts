/** Crea una Credencial de muestra (storageState vacío); idempotente por nombre en el proyecto. */
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

  // Cast explícito: Buffer no es asignable al genérico estricto Uint8Array<ArrayBuffer> de Prisma.
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