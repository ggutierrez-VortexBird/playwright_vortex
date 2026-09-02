import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

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

export async function listEjecuciones(proyectoId?: string) {
  const where: Prisma.EjecucionWhereInput = {}
  if (proyectoId) {
    where.casoPrueba = { proyectoId }
  }

  const ejecuciones = await prisma.ejecucion.findMany({
    where,
    include: {
      casoPrueba: {
        include: {
          proyecto: {
            include: { espacio: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ejecuciones
}

export async function listEjecucionesPorProyecto() {
  const ejecuciones = await listEjecuciones()

  // Agrupar por proyecto
  const porProyecto: Record<string, typeof ejecuciones> = {}
  for (const ejec of ejecuciones) {
    const pid = ejec.casoPrueba.proyectoId
    if (!porProyecto[pid]) porProyecto[pid] = []
    porProyecto[pid].push(ejec)
  }

  return porProyecto
}
