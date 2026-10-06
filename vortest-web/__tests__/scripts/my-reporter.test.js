// __tests__/scripts/my-reporter.test.js
// TDD RED/GREEN/TRIANGULATE for HU-4.5 custom Playwright reporter
// Verifies 6 event types emitted to stdout: env, step, substep, log, assertion, end

const JsonReporter = require('../../scripts/my-reporter.js')

describe('JsonReporter — HU-4.5 multi-event emitter', () => {
  let reporter
  let stdoutSpy

  beforeEach(() => {
    reporter = new JsonReporter()
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
  })

  function parseLines() {
    return stdoutSpy.mock.calls
      .map((call) => call[0])
      .filter((line) => line.trim())
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
  }

  it('emite evento env en onBegin con navegador, SO y nodo', () => {
    reporter.onBegin({ projects: [{ use: { browserName: 'chromium' } }] })
    const events = parseLines()
    const env = events.find((e) => e.type === 'env')
    expect(env).toBeDefined()
    expect(env.navegador).toBe('chromium')
    expect(env.sistemaOperativo).toBeDefined()
    expect(env.nodoEjecucion).toBeDefined()
  })

  it('emite evento step en onTestEnd con estado paso y duracion', () => {
    const testMock = { title: 'should login', annotations: [] }
    const resultMock = { status: 'passed', duration: 1234, errors: [], steps: [] }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const step = events.find((e) => e.type === 'step')
    expect(step).toBeDefined()
    expect(step.descripcion).toBe('should login')
    expect(step.estado).toBe('paso')
    expect(step.duracionMs).toBe(1234)
    expect(step.errorCount).toBe(0)
    expect(step.resultadoEsperado).toBeNull()
  })

  it('emite evento step con estado fallo y errorMsg cuando hay errores', () => {
    const testMock = { title: 'should fail', annotations: [] }
    const resultMock = { status: 'failed', duration: 500, errors: [{ message: 'boom', stack: '' }], steps: [] }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const step = events.find((e) => e.type === 'step')
    expect(step.estado).toBe('fallo')
    expect(step.errorCount).toBe(1)
    expect(step.errorMsg).toBe('boom')
    expect(step.resultadoObtenido).toContain('boom')
  })

  it('deriva resultadoEsperado de annotations cuando existe', () => {
    const testMock = { title: 'should work', annotations: [{ type: 'test', description: 'Expected result here' }] }
    const resultMock = { status: 'passed', duration: 100, errors: [], steps: [] }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const step = events.find((e) => e.type === 'step')
    expect(step.resultadoEsperado).toBe('Expected result here')
  })

  it('emite substep events por cada step de Playwright', () => {
    const testMock = { title: 'parent', annotations: [] }
    reporter.onTestBegin(testMock)

    const stepMock = {
      title: 'Click button',
      category: 'test.step',
      error: null,
      duration: 200,
    }
    reporter.onStepEnd(testMock, {}, stepMock)

    const resultMock = {
      status: 'passed',
      duration: 300,
      errors: [],
      steps: [stepMock],
    }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const substep = events.find((e) => e.type === 'substep')
    expect(substep).toBeDefined()
    expect(substep.descripcion).toBe('Click button')
    expect(substep.tipo).toBe('action')
  })

  it('no emite substep para Before Hooks / After Hooks / Worker Cleanup (categoria hook)', () => {
    const testMock = { title: 'parent', annotations: [] }
    reporter.onTestBegin(testMock)

    reporter.onStepEnd(testMock, {}, { title: 'Before Hooks', category: 'hook', error: null, duration: 100 })
    reporter.onStepEnd(testMock, {}, { title: 'After Hooks', category: 'hook', error: null, duration: 100 })
    reporter.onStepEnd(testMock, {}, { title: 'Worker Cleanup', category: 'hook', error: null, duration: 100 })

    const events = parseLines()
    expect(events.find((e) => e.type === 'substep')).toBeUndefined()
  })

  it('no emite substep para pasos anidados dentro de un hook o fixture (Launch browser, Close context...)', () => {
    const testMock = { title: 'parent', annotations: [] }
    reporter.onTestBegin(testMock)

    const beforeHooks = { title: 'Before Hooks', category: 'hook', error: null, duration: 200 }
    const fixtureBrowser = { title: 'Fixture "browser"', category: 'fixture', error: null, duration: 100, parent: beforeHooks }
    const launchBrowser = { title: 'Launch browser', category: 'pw:api', error: null, duration: 90, parent: fixtureBrowser }

    reporter.onStepEnd(testMock, {}, launchBrowser)
    reporter.onStepEnd(testMock, {}, fixtureBrowser)
    reporter.onStepEnd(testMock, {}, beforeHooks)

    const events = parseLines()
    expect(events.find((e) => e.type === 'substep')).toBeUndefined()
  })

  it('emite un solo substep por accion real, sin duplicarla via el step padre (test.step)', () => {
    const testMock = { title: 'parent', annotations: [] }
    reporter.onTestBegin(testMock)

    const groupStep = { title: 'Verificar titulo', category: 'test.step', error: null, duration: 150 }
    const clickStep = { title: "Click locator('h1')", category: 'pw:api', error: null, duration: 30, parent: groupStep }

    // Playwright llama a onStepEnd una vez por cada step del arbol, hijo primero.
    reporter.onStepEnd(testMock, {}, clickStep)
    reporter.onStepEnd(testMock, {}, groupStep)

    const events = parseLines().filter((e) => e.type === 'substep')
    const clicks = events.filter((e) => e.descripcion === "Click locator('h1')")
    expect(clicks).toHaveLength(1)
  })

  it('mantiene un assert anidado dentro de un test.step (no es hook/fixture)', () => {
    const testMock = { title: 'parent', annotations: [] }
    reporter.onTestBegin(testMock)

    const groupStep = { title: 'Verificar titulo', category: 'test.step', error: null, duration: 150 }
    const expectStep = { title: 'Expect "toHaveTitle"', category: 'expect', error: null, duration: 20, parent: groupStep }

    reporter.onStepEnd(testMock, {}, expectStep)

    const events = parseLines()
    expect(events.find((e) => e.type === 'assertion')).toBeDefined()
    const substep = events.find((e) => e.type === 'substep')
    expect(substep).toBeDefined()
    expect(substep.tipo).toBe('assertion')
  })

  it('emite evento end en onEnd con estado y aserciones', () => {
    reporter.onEnd({ status: 'passed', duration: 5000 })
    const events = parseLines()
    const end = events.find((e) => e.type === 'end')
    expect(end).toBeDefined()
    expect(end.estado).toBe('paso')
    expect(end.duracionMs).toBe(5000)
    expect(end.asercionesTotal).toBeDefined()
  })

  it('no emite errorMsg cuando no hay errores', () => {
    const testMock = { title: 'clean', annotations: [] }
    const resultMock = { status: 'passed', duration: 100, errors: [], steps: [] }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const step = events.find((e) => e.type === 'step')
    expect(step.errorMsg).toBeNull()
  })

  it('emite selfHealed=true cuando pasó con errores (flaky)', () => {
    const testMock = { title: 'flaky', annotations: [] }
    const resultMock = { status: 'passed', duration: 100, errors: [{ message: 'retry' }], steps: [] }
    reporter.onTestEnd(testMock, resultMock)
    const events = parseLines()
    const step = events.find((e) => e.type === 'step')
    expect(step.selfHealed).toBe(true)
    expect(step.estado).toBe('reparado')
  })
})
