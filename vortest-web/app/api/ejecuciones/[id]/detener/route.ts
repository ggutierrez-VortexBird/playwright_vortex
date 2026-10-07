import { NextResponse } from 'next/server'
import { detenerEjecucion } from '@/lib/ejecuciones/actions'
import { EJECUCION_YA_TERMINADA_ERROR } from '@/lib/ejecuciones/errors'
import { isNotFoundError } from '@/lib/http/errors'
import { withAuth } from '@/lib/http/with-auth'

/**
 * POST /api/ejecuciones/[id]/detener
 *
 * Cancela una ejecución en estado `pendiente` o `corriendo`.
 * Decisiones de producto:
 * - Cancelación dura: el worker mata el proceso Playwright (SIGTERM).
 * - Permite cancelar también desde `pendiente`.
 * - NO registra quién canceló — solo el estado `cancelado`.
 */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (_request, { params }) => {
    const { id } = await params
    try {
      const result = await detenerEjecucion(id)
      return NextResponse.json(result)
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        return NextResponse.json(
          { error: 'Ejecución no encontrada' },
          { status: 404 }
        )
      }
      if (
        error === EJECUCION_YA_TERMINADA_ERROR ||
        (error as { message?: string })?.message === 'EJECUCION_YA_TERMINADA'
      ) {
        return NextResponse.json(
          { error: 'La ejecución ya terminó, no se puede detener' },
          { status: 409 }
        )
      }
      // FORBIDDEN → 403 "Sin permisos"; resto → 500 (withAuth/mapErrorToResponse).
      throw error
    }
  }
)
