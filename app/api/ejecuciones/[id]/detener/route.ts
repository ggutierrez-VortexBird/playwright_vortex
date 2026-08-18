import { NextResponse } from 'next/server'
import { detenerEjecucion } from '@/lib/ejecuciones/actions'
import { EJECUCION_YA_TERMINADA_ERROR } from '@/lib/ejecuciones/errors'
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR } from '@/lib/auth'

/**
 * POST /api/ejecuciones/[id]/detener
 *
 * Cancela una ejecución en estado `pendiente` o `corriendo`.
 * Decisiones de producto:
 * - Cancelación dura: el worker mata el proceso Playwright (SIGTERM).
 * - Permite cancelar también desde `pendiente`.
 * - NO registra quién canceló — solo el estado `cancelado`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const result = await detenerEjecucion(id)
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error === NOT_FOUND_ERROR || (error as any)?.message === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Ejecución no encontrada' },
        { status: 404 }
      )
    }
    if (
      error === EJECUCION_YA_TERMINADA_ERROR ||
      (error as any)?.message === 'EJECUCION_YA_TERMINADA'
    ) {
      return NextResponse.json(
        { error: 'La ejecución ya terminó, no se puede detener' },
        { status: 409 }
      )
    }
    if (error === FORBIDDEN_ERROR || (error as any)?.message === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Sin permisos' },
        { status: 403 }
      )
    }
    console.error('[POST /api/ejecuciones/[id]/detener]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
