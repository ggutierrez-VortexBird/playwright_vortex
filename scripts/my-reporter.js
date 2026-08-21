// Reporter custom para Playwright — emite eventos JSON por stdout para que el
// worker los parsee e inserte como PasoEjecucion / PasoSubaccion.
//
// Emite 5 tipos de evento directamente:
//   env, step, substep, assertion, end
// Los eventos 'log' se emiten vía fixture global (ver lib/fixtures/log-capture.ts)
//
// NOTA: Playwright Reporter API requiere una Clase.

class JsonReporter {
  constructor() {
    this.testCounter = 0
    this.substepCounters = new Map() // testCounter -> substep number
    this.assertionCounters = { total: 0, ok: 0, fail: 0 }
  }

  onBegin(config) {
    const project = config.projects?.[0]
    const browserName = project?.use?.browserName ?? 'chromium'
    const event = {
      type: 'env',
      navegador: browserName,
      sistemaOperativo: this._detectOS(),
      nodoEjecucion: this._detectHostname(),
    }
    this._emit(event)
  }

  onTestBegin(test) {
    this.testCounter++
    this.substepCounters.set(this.testCounter, 0)
  }

  onStepEnd(test, result, step) {
    // Emit assertion events for expect steps
    if (step.category === 'expect') {
      this.assertionCounters.total++
      const ok = !step.error
      if (ok) this.assertionCounters.ok++
      else this.assertionCounters.fail++

      const assertionEvent = {
        type: 'assertion',
        parentTestId: this.testCounter,
        descripcion: step.title,
        ok,
      }
      this._emit(assertionEvent)
      return
    }

    // Skip non-substep categories
    if (step.category !== 'test.step') return

    const parentTestId = this.testCounter
    const prev = this.substepCounters.get(parentTestId) ?? 0
    const numero = prev + 1
    this.substepCounters.set(parentTestId, numero)

    const estado = step.error ? 'fallo' : 'paso'

    const substepEvent = {
      type: 'substep',
      parentTestId,
      numero,
      tipo: this._classifyStepType(step.title),
      descripcion: step.title,
      estado,
      duracionMs: step.duration,
      errorMsg: step.error ? this._extractErrorMsg(step.error) : null,
      capturaActualPath: null,
      capturaReferenciaPath: null,
    }
    this._emit(substepEvent)
  }

  onTestEnd(test, result) {
    let estado
    let selfHealed = false

    if (result.status === 'passed') {
      selfHealed = result.errors.length > 0
      estado = selfHealed ? 'reparado' : 'paso'
    } else if (result.status === 'failed') {
      estado = 'fallo'
    } else if (result.status === 'skipped') {
      estado = 'paso'
    } else {
      estado = 'fallo'
    }

    const errorCount = result.errors.length
    const errorMsg = errorCount > 0 ? this._extractErrorMsg(result.errors[0]) : null
    const resultadoObtenido = errorCount > 0
      ? result.errors.map((e) => this._extractErrorMsg(e)).join('; ')
      : null

    const resultadoEsperado = this._deriveResultadoEsperado(test)

    const event = {
      type: 'step',
      numero: this.testCounter,
      descripcion: test.title,
      estado,
      duracionMs: result.duration,
      selfHealed,
      errorMsg,
      resultadoEsperado,
      resultadoObtenido,
      errorCount,
    }
    this._emit(event)
  }

  onEnd(result) {
    const estadoMap = {
      passed: 'paso',
      failed: 'fallo',
      timedout: 'errorMotor',
      interrupted: 'errorMotor',
    }
    const event = {
      type: 'end',
      estado: estadoMap[result.status] ?? 'errorMotor',
      duracionMs: result.duration,
      asercionesTotal: this.assertionCounters.total,
      asercionesOk: this.assertionCounters.ok,
      asercionesFail: this.assertionCounters.fail,
    }
    this._emit(event)
  }

  _emit(event) {
    process.stdout.write(JSON.stringify(event) + '\n')
  }

  _detectOS() {
    const platform = process.platform
    if (platform === 'win32') return 'Windows'
    if (platform === 'darwin') return 'macOS'
    return 'Linux'
  }

  _detectHostname() {
    try {
      const os = require('os')
      return os.hostname()
    } catch {
      return 'unknown'
    }
  }

  _deriveResultadoEsperado(test) {
    const annotation = test.annotations?.find((a) => a.type === 'test' && a.description)
    if (annotation) return annotation.description
    return null
  }

  _extractErrorMsg(error) {
    if (!error) return null
    if (typeof error === 'string') return error
    return error.message ?? error.toString?.() ?? null
  }

  _classifyStepType(title) {
    const t = (title || '').toLowerCase()
    if (t.includes('assert') || t.includes('expect') || t.includes('verify')) return 'assertion'
    if (t.includes('navigate') || t.includes('goto') || t.includes('visit')) return 'navigate'
    if (t.includes('setup') || t.includes('before') || t.includes('after')) return 'setup'
    if (t.includes('click') || t.includes('fill') || t.includes('type') || t.includes('press') || t.includes('select')) return 'action'
    return 'other'
  }
}

module.exports = JsonReporter
