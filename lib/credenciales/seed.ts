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

  return (await prisma.credencial.create({
    data: {
      proyectoId,
      nombre: DEMO_NOMBRE,
      tipo: DEMO_TIPO,
      valor: encryptCredencial(DEMO_STORAGE_STATE) as unknown as Uint8Array,
    },
  })) as CredencialDemo;
}