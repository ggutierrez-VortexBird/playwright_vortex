import { NextResponse } from 'next/server'
import { dispararEjecucion } from '@/lib/ejecuciones/actions'
import { YA_EXISTE_EJECUCION_EN_CURSO_ERROR } from '@/lib/ejecuciones/errors'
import { isForbiddenError, isNotFoundError } from '@/lib/http/errors'
import { withAuth } from '@/lib/http/with-auth'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { casoPruebaId } = body

    if (!casoPruebaId) {
      return NextResponse.json(
        { error: 'casoPruebaId es requerido' },
        { status: 400 }
      )
    }

    const result = await dispararEjecucion(casoPruebaId)
    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error === YA_EXISTE_EJECUCION_EN_CURSO_ERROR) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: 'Ya existe una ejecución en curso para este caso',
        },
        { status: 409 }
      )
    }
    if (isForbiddenError(error)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'No tienes acceso a este proyecto' },
        { status: 403 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: 'not_found', message: 'Caso de prueba no encontrado' },
        { status: 404 }
      )
    }
    // Cualquier otro error lo traduce withAuth → mapErrorToResponse (500).
    throw error
  }
})

export const GET = withAuth(async () => {
  // GET /api/ejecuciones — listado global (la página /ejecuciones usa el server component)
  return NextResponse.json(
    { error: 'Use /ejecuciones page for listing' },
    { status: 200 }
  )
})
