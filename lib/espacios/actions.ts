import { prisma } from "@/lib/db";
import type { CreateEspacioInput, UpdateEspacioInput } from "@/types/espacio";

export async function listEspacios() {
  return prisma.espacio.findMany({
    where: { activo: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createEspacio(input: CreateEspacioInput) {
  const { nombre, color } = input;

  if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "nombre is required" } };
  }

  if (!color || typeof color !== "string" || color.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "color is required" } };
  }

  return prisma.espacio.create({
    data: {
      nombre: nombre.trim(),
      color: color.trim(),
    },
  });
}

export async function getEspacioById(id: string) {
  return prisma.espacio.findUnique({
    where: { id },
  });
}

export async function updateEspacio(id: string, input: UpdateEspacioInput) {
  const existing = await prisma.espacio.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const updateData: UpdateEspacioInput = {};
  if (input.nombre !== undefined) {
    updateData.nombre = input.nombre.trim();
  }
  if (input.color !== undefined) {
    updateData.color = input.color.trim();
  }

  return prisma.espacio.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteEspacio(id: string) {
  const existing = await prisma.espacio.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await prisma.espacio.update({
    where: { id },
    data: { activo: false },
  });

  return { success: true };
}
