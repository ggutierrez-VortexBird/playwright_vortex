import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireProyectoAccess, scopeProyectoWhere } from "@/lib/auth";
import type { SessionData, UsuarioActual } from "@/lib/auth";
import type { CasoPruebaFormData, CasoPruebaListItem, ParentCaseOption } from "@/types/caso";

const ALLOWED_SCRIPT_EXTENSIONS = [".spec.ts", ".test.ts", ".spec.js", ".test.js"];

function validateScriptFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const lower = fileName.toLowerCase();
  const isValid = ALLOWED_SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!isValid) {
    throw {
      status: 400,
      body: {
        error: "validation",
        message: `Extensión inválida. Debe ser ${ALLOWED_SCRIPT_EXTENSIONS.join(" o ")}`,
      },
    };
  }
  return fileName.trim();
}

/**
 * Valida que un caso padre sea válido y no genere ciclos.
 */
export async function validateParentCaseId(
  parentCaseId: string | null | undefined,
  proyectoId: string,
  ownId?: string
): Promise<string | null> {
  if (!parentCaseId || parentCaseId.trim() === "") return null;

  if (parentCaseId === ownId) {
    throw { status: 400, body: { error: "validation", message: "Un caso no puede ser padre de sí mismo" } };
  }

  const parent = await prisma.casoPrueba.findUnique({
    where: { id: parentCaseId },
  });

  if (!parent) {
    throw { status: 400, body: { error: "validation", message: "Caso padre no encontrado" } };
  }

  if (parent.proyectoId !== proyectoId) {
    throw { status: 400, body: { error: "validation", message: "El caso padre debe pertenecer al mismo proyecto" } };
  }

  if (parent.parentCaseId === ownId) {
    throw { status: 400, body: { error: "validation", message: "No se permite un ciclo entre casos padre e hijo" } };
  }

  return parentCaseId.trim();
}

/**
 * Create a new caso de prueba within a proyecto.
 * Requiere superadmin, admin del espacio del proyecto, o tester con acceso
 * al proyecto.
 */
export async function createCaso(
  input: CasoPruebaFormData,
  session: SessionData
) {
  const { codigo, nombre, script, scriptFileName, responsableId, proyectoId, parentCaseId } = input;

  if (!proyectoId || typeof proyectoId !== "string" || proyectoId.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "proyectoId is required" } };
  }

  await requireProyectoAccess(session, proyectoId.trim());

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

  const validatedFileName = validateScriptFileName(scriptFileName);
  const validatedParentCaseId = await validateParentCaseId(parentCaseId, proyectoId.trim());

  try {
    const caso = await prisma.casoPrueba.create({
      data: {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        script: script.trim(),
        scriptFileName: validatedFileName,
        responsableId: responsableId.trim(),
        proyectoId: proyectoId.trim(),
        parentCaseId: validatedParentCaseId,
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
      parentCaseId: caso.parentCaseId,
      parentCaseCodigo: null,
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
 * List active casos de prueba, optionally filtered by proyectoId. Si se
 * pasa `usuario`, se filtra además por su alcance (admin: casos de
 * proyectos de sus espacios; tester: solo de sus proyectos asignados).
 * Computes estado from latest ejecucion.
 */
export async function listCasos(proyectoId?: string, usuario?: UsuarioActual | null): Promise<CasoPruebaListItem[]> {
  const where: Prisma.CasoPruebaWhereInput = { activo: true };
  if (proyectoId) {
    where.proyectoId = proyectoId;
  }
  if (usuario) {
    where.proyecto = scopeProyectoWhere(usuario);
  }

  const casos = await prisma.casoPrueba.findMany({
    where,
    include: {
      proyecto: { select: { nombre: true } },
      responsable: { select: { email: true } },
      parentCase: { select: { codigo: true } },
      ejecuciones: {
        include: { pasos: { select: { id: true, numero: true, estado: true } } },
        orderBy: { finAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return casos.map((caso) => {
    const estado = computeEstado(caso.ejecuciones);
    const fechaUltimaEjecucion = computeFechaUltimaEjecucion(caso.ejecuciones);
    const pasosCount = caso.ejecuciones[0]?.pasos.length ?? null;
    const ultimaEjecucionId = caso.ejecuciones[0]?.id ?? null;
    const primerPasoFallido = caso.ejecuciones[0]?.pasos.find(p => p.estado === 'fallo');
    const primerPasoFallidoNumero = primerPasoFallido?.numero ?? null;
    return {
      id: caso.id,
      proyectoId: caso.proyectoId,
      proyectoNombre: caso.proyecto.nombre,
      codigo: caso.codigo,
      nombre: caso.nombre,
      scriptFileName: caso.scriptFileName,
      responsableId: caso.responsableId,
      responsableEmail: caso.responsable.email,
      parentCaseId: caso.parentCaseId,
      parentCaseCodigo: caso.parentCase?.codigo ?? null,
      estado,
      origen: caso.origen,
      activo: caso.activo,
      fechaUltimaEjecucion,
      pasosCount,
      ultimaEjecucionId,
      primerPasoFallidoNumero,
      createdAt: caso.createdAt,
      updatedAt: caso.updatedAt,
    };
  });
}

/**
 * List cases eligible to be a parent for a given proyecto.
 * Excludes a specific case when editing (to avoid self-reference).
 */
export async function listParentCaseOptions(
  proyectoId: string,
  excludeId?: string
): Promise<ParentCaseOption[]> {
  const casos = await prisma.casoPrueba.findMany({
    where: {
      proyectoId,
      activo: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" },
  });
  return casos;
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
      parentCase: { select: { codigo: true } },
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
    parentCaseId: caso.parentCaseId,
    parentCaseCodigo: caso.parentCase?.codigo ?? null,
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
  const existing = await prisma.casoPrueba.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await requireProyectoAccess(session, existing.proyectoId);

  const updateData: Prisma.CasoPruebaUncheckedUpdateInput = {};

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
    updateData.scriptFileName = validateScriptFileName(input.scriptFileName);
  }
  if (input.responsableId !== undefined) {
    updateData.responsableId = input.responsableId.trim();
  }
  if (input.proyectoId !== undefined) {
    const nuevoProyectoId = input.proyectoId.trim();
    // Mover un caso a otro proyecto requiere acceso al proyecto DESTINO
    // también — el guard de arriba solo cubrió el proyecto de origen.
    if (nuevoProyectoId !== existing.proyectoId) {
      await requireProyectoAccess(session, nuevoProyectoId);
    }
    updateData.proyectoId = nuevoProyectoId;
  }

  const proyectoIdForValidation = input.proyectoId !== undefined ? input.proyectoId.trim() : existing.proyectoId;
  updateData.parentCaseId = await validateParentCaseId(input.parentCaseId, proyectoIdForValidation, id);

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
      parentCaseId: caso.parentCaseId,
      parentCaseCodigo: null,
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
  const existing = await prisma.casoPrueba.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await requireProyectoAccess(session, existing.proyectoId);

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
