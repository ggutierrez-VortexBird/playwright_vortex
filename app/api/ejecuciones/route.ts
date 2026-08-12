import { NextResponse } from 'next/server'
import {
  dispararEjecucion,
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
} from '@/lib/ejecuciones/actions'
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR } from '@/lib/auth'

export async function POST(request: Request) {
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
    if (error === FORBIDDEN_ERROR) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Se requiere rol de superadmin' },
        { status: 403 }
      )
    }
    if (error === NOT_FOUND_ERROR) {
      return NextResponse.json(
        { error: 'not_found', message: 'Caso de prueba no encontrado' },
        { status: 404 }
      )
    }
    console.error('[POST /api/ejecuciones]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET() {
  // GET /api/ejecuciones — listado global (la página /ejecuciones usa el server component)
  return NextResponse.json(
    { error: 'Use /ejecuciones page for listing' },
    { status: 200 }
  )
}
