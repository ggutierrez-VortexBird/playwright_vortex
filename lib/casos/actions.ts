import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";
import type { CasoPruebaFormData, CasoPruebaListItem } from "@/types/caso";

/**
 * Create a new caso de prueba within a proyecto.
 * Requires superadmin role.
 */
export async function createCaso(
  input: CasoPruebaFormData,
  session: SessionData
) {
  await requireSuperadmin(session);

  const { codigo, nombre, script, scriptFileName, responsableId, proyectoId } = input;

  // Validate required fields
  if (!codigo || typeof codigo !== "string" || codigo.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "codigo is required" } };
  }

  if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "nombre is required" } };
  }

  if (!script || typeof script !== "string" || script.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "script is required" } };
  }

  if (!responsableId || typeof responsableId !== "string" || responsableId.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "responsableId is required" } };
  }

  if (!proyectoId || typeof proyectoId !== "string" || proyectoId.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "proyectoId is required" } };
  }

  try {
    const caso = await prisma.casoPrueba.create({
      data: {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        script: script.trim(),
        scriptFileName: scriptFileName?.trim() || null,
        responsableId: responsableId.trim(),
        proyectoId: proyectoId.trim(),
      },
    });

    return {
      id: caso.id,
      proyectoId: caso.proyectoId,
      codigo: caso.codigo,
      nombre: caso.nombre,
      script: caso.script,
      scriptFileName: caso.scriptFileName,
      responsableId: caso.responsableId,
      estado: "sin ejecuciones" as const,
      activo: caso.activo,
      createdAt: caso.createdAt,
      updatedAt: caso.updatedAt,
    };
  } catch (err: any) {
    if (err.code === "P2002") {
      throw { status: 409, body: { error: "conflict", message: "Código duplicado en este proyecto" } };
    }
    throw err;
  }
}

/**
 * List active casos de prueba, optionally filtered by proyectoId.
 * Computes estado from latest ejecucion.
 */
export async function listCasos(proyectoId?: string): Promise<CasoPruebaListItem[]> {
  const where: any = { activo: true };
  if (proyectoId) {
    where.proyectoId = proyectoId;
  }

  const casos = await prisma.casoPrueba.findMany({
    where,
    include: {
      proyecto: { select: { nombre: true } },
      responsable: { select: { email: true } },
      ejecuciones: { orderBy: { finAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return casos.map((caso) => {
    const estado = computeEstado(caso.ejecuciones);
    const fechaUltimaEjecucion = computeFechaUltimaEjecucion(caso.ejecuciones);
    return {
      id: caso.id,
      proyectoId: caso.proyectoId,
      proyectoNombre: caso.proyecto.nombre,
      codigo: caso.codigo,
      nombre: caso.nombre,
      scriptFileName: caso.scriptFileName,
      responsableId: caso.responsableId,
      responsableEmail: caso.responsable.email,
      estado,
      activo: caso.activo,
      fechaUltimaEjecucion,
      createdAt: caso.createdAt,
      updatedAt: caso.updatedAt,
    };
  });
}

/**
 * Get a single caso by ID with proyecto and responsable names.
 */
export async function getCasoById(id: string) {
  const caso = await prisma.casoPrueba.findUnique({
    where: { id },
    include: {
      proyecto: { select: { nombre: true } },
      responsable: { select: { email: true } },
      ejecuciones: { orderBy: { finAt: "desc" } },
    },
  });

  if (!caso) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const estado = computeEstado(caso.ejecuciones);
  const fechaUltimaEjecucion = computeFechaUltimaEjecucion(caso.ejecuciones);

  return {
    id: caso.id,
    proyectoId: caso.proyectoId,
    proyectoNombre: caso.proyecto.nombre,
    codigo: caso.codigo,
    nombre: caso.nombre,
    script: caso.script,
    scriptFileName: caso.scriptFileName,
    responsableId: caso.responsableId,
    responsableEmail: caso.responsable.email,
    estado,
    activo: caso.activo,
    fechaUltimaEjecucion,
    createdAt: caso.createdAt,
    updatedAt: caso.updatedAt,
  };
}

/**
 * Update an existing caso.
 * Requires superadmin role.
 */
export async function updateCaso(
  id: string,
  input: Partial<CasoPruebaFormData>,
  session: SessionData
) {
  await requireSuperadmin(session);

  const existing = await prisma.casoPrueba.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const updateData: any = {};

  if (input.codigo !== undefined) {
    updateData.codigo = input.codigo.trim();
  }
  if (input.nombre !== undefined) {
    updateData.nombre = input.nombre.trim();
  }
  if (input.script !== undefined) {
    if (!input.script || input.script.trim() === "") {
      throw { status: 400, body: { error: "validation", message: "script is required" } };
    }
    updateData.script = input.script.trim();
  }
  if (input.scriptFileName !== undefined) {
    updateData.scriptFileName = input.scriptFileName?.trim() || null;
  }
  if (input.responsableId !== undefined) {
    updateData.responsableId = input.responsableId.trim();
  }
  if (input.proyectoId !== undefined) {
    updateData.proyectoId = input.proyectoId.trim();
  }

  try {
    const caso = await prisma.casoPrueba.update({
      where: { id },
      data: updateData,
    });

    return {
      id: caso.id,
      proyectoId: caso.proyectoId,
      codigo: caso.codigo,
      nombre: caso.nombre,
      script: caso.script,
      scriptFileName: caso.scriptFileName,
      responsableId: caso.responsableId,
      estado: "sin ejecuciones" as const,
      activo: caso.activo,
      createdAt: caso.createdAt,
      updatedAt: caso.updatedAt,
    };
  } catch (err: any) {
    if (err.code === "P2002") {
      throw { status: 409, body: { error: "conflict", message: "Código duplicado en este proyecto" } };
    }
    throw err;
  }
}

/**
 * Soft delete a caso (sets activo: false).
 * Requires superadmin role.
 */
export async function deleteCaso(id: string, session: SessionData) {
  await requireSuperadmin(session);

  const existing = await prisma.casoPrueba.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await prisma.casoPrueba.update({
    where: { id },
    data: { activo: false },
  });

  return { success: true };
}

/**
 * Compute estado for a caso based on its ejecuciones.
 */
function computeEstado(ejecuciones: Array<{ estado: string; finAt: Date | null; inicioAt: Date | null }>): "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor" {
  if (ejecuciones.length === 0) {
    return "sin ejecuciones";
  }

  // ejecuciones are ordered by finAt desc from Prisma
  const latest = ejecuciones[0];
  const estado = latest.estado as "paso" | "fallo" | "reparado" | "errorMotor";
  return estado;
}

/**
 * Compute fechaUltimaEjecucion for a caso based on its ejecuciones.
 */
function computeFechaUltimaEjecucion(ejecuciones: Array<{ finAt: Date | null; inicioAt: Date | null }>): string | null {
  if (ejecuciones.length === 0) {
    return null;
  }
  const latest = ejecuciones[0];
  const date = latest.finAt || latest.inicioAt;
  return date ? date.toISOString() : null;
}
