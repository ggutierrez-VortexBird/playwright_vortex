// __tests__/lib/worker/paso-ejecucion-schema.test.ts
// TDD RED: Assert Prisma schema includes new models and fields for HU-4.5

import * as fs from 'fs'
import * as path from 'path'

const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma')

describe('Prisma Schema — HU-4.5 accordion step detail', () => {
  let schema: string

  beforeAll(() => {
    schema = fs.readFileSync(schemaPath, 'utf-8')
  })

  it('define el modelo PasoSubaccion con campos requeridos', () => {
    expect(schema).toContain('model PasoSubaccion')
    expect(schema).toContain('ejecucionId')
    expect(schema).toContain('pasoEjecucionId')
    expect(schema).toContain('numero')
    expect(schema).toContain('tipo')
    expect(schema).toContain('descripcion')
    expect(schema).toContain('estado')
    expect(schema).toContain('duracionMs')
    expect(schema).toContain('errorMsg')
    expect(schema).toContain('logs')
    expect(schema).toContain('capturaActualId')
    expect(schema).toContain('capturaReferenciaId')
  })

  it('agrega campos nuevos a PasoEjecucion', () => {
    expect(schema).toContain('resultadoEsperado')
    expect(schema).toContain('resultadoObtenido')
    expect(schema).toContain('errorCount')
    expect(schema).toContain('logs')
  })

  it('agrega campos de entorno y aserciones a Ejecucion', () => {
    expect(schema).toContain('entorno')
    expect(schema).toContain('navegador')
    expect(schema).toContain('sistemaOperativo')
    expect(schema).toContain('nodoEjecucion')
    expect(schema).toContain('asercionesTotal')
    expect(schema).toContain('asercionesOk')
    expect(schema).toContain('asercionesFail')
  })

  it('agrega metadata Json? a Artefacto', () => {
    expect(schema).toContain('metadata')
  })

  it('define relaciones de back-reference correctas', () => {
    expect(schema).toContain('subacciones')
    expect(schema).toContain('capturaActual')
    expect(schema).toContain('capturaReferencia')
  })
})
