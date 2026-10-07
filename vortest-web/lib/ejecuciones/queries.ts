import { prisma } from '@/lib/db'
import { Prisma, type EjecucionEstado } from '@prisma/client'
import { scopeProyectoWhere } from '@/lib/auth'
import type { UsuarioActual } from '@/lib/auth'
import { FILTROS_ESTADO, esFiltroEstado } from './estado'

export async function getEjecucionConPasos(id: string) {
  return prisma.ejecucion.findUnique({
    where: { id },
    include: {
      casoPrueba: {
        include: {
          proyecto: {
            include: { espacio: true }
          }
        }
      },
      pasos: {
        orderBy: { numero: 'asc' },
        include: {
          subacciones: {
            orderBy: { numero: 'asc' },
            include: {
              capturaActual: true,
              capturaReferencia: true,
            },
          },
        },
      },
      artefactos: {
        orderBy: { createdAt: 'asc' }
      },
      // HU-G19 — acta asociada (1-a-1 con Ejecucion)
      acta: true,
    }
  })
}

function whereListado(usuario: UsuarioActual | undefined, proyectoId?: string, q?: string): Prisma.EjecucionWhereInput {
  const where: Prisma.EjecucionWhereInput = {}
  if (proyectoId) {
    where.casoPrueba = { proyectoId }
  } else if (usuario) {
    where.casoPrueba = { proyecto: scopeProyectoWhere(usuario) }
  }
  if (q) {
    where.OR = [
      { casoPrueba: { nombre: { contains: q, mode: 'insensitive' } } },
      { casoPrueba: { codigo: { contains: q, mode: 'insensitive' } } },
    ]
  }
  return where
}

/** Totales reales por estado (toda la consulta, no sólo la página visible), con el mismo alcance y búsqueda que el listado. */
export async function contarEjecucionesPorEstado(usuario?: UsuarioActual | null, q?: string) {
  if (usuario === null) return {} as Record<string, number>
  const filas = await prisma.ejecucion.groupBy({
    by: ['estado'],
    where: whereListado(usuario, undefined, q),
    _count: { _all: true },
  })
  return Object.fromEntries(filas.map((f) => [f.estado, f._count._all])) as Record<string, number>
}

export async function listEjecuciones(
  proyectoId?: string,
  usuario?: UsuarioActual | null,
  page: number = 1,
  pageSize: number = 20,
  q?: string,
  estado?: string
) {
  // `null` = sesión sin usuario activo (borrado o desactivado): nunca listar sin filtro; `undefined` queda para usos internos sin alcance.
  if (usuario === null) return { ejecuciones: [], hasNextPage: false, total: 0 }
  const skip = (page - 1) * pageSize

  const where = whereListado(usuario, proyectoId, q)
  if (esFiltroEstado(estado)) {
    where.estado = { in: [...FILTROS_ESTADO[estado]] as EjecucionEstado[] }
  }

  const [ejecuciones, total] = await Promise.all([prisma.ejecucion.findMany({
    where,
    // `select` explícito: estas filas llegan a componentes de cliente y no deben llevar storageState (cookies del sitio bajo prueba) ni el script.
    select: {
      id: true,
      estado: true,
      createdAt: true,
      inicioAt: true,
      finAt: true,
      duracionMs: true,
      casoPrueba: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          proyectoId: true,
          proyecto: { select: { id: true, nombre: true, espacio: { select: { id: true, nombre: true, color: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: pageSize + 1, // take one extra to detect hasNextPage
    skip,
  }), prisma.ejecucion.count({ where })])

  const hasNextPage = ejecuciones.length > pageSize
  if (hasNextPage) ejecuciones.pop() // remove the extra one

  return { ejecuciones, hasNextPage, total }
}

export async function listEjecucionesPorProyecto(
  usuario?: UsuarioActual | null,
  page: number = 1,
  pageSize: number = 20,
  q?: string,
  estado?: string
) {
  const { ejecuciones, hasNextPage, total } = await listEjecuciones(undefined, usuario, page, pageSize, q, estado)

  // Agrupar por proyecto
  const porProyecto: Record<string, typeof ejecuciones> = {}
  for (const ejec of ejecuciones) {
    const pid = ejec.casoPrueba.proyectoId
    if (!porProyecto[pid]) porProyecto[pid] = []
    porProyecto[pid].push(ejec)
  }

  return { porProyecto, hasNextPage, total }
}
