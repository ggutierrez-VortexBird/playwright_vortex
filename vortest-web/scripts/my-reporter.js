// Reporter de Playwright: emite eventos JSON (env, step, substep, assertion, end) por stdout; un substep por acción real, sin hooks ni fixtures.

class JsonReporter {
  constructor() {
    this.testCounter = 0
    this.substepCounters = new Map() // testCounter -> número de substep
    this.assertionCounters = { total: 0, ok: 0, fail: 0 }
    // Origen del reloj para los timestamps de capítulos de video; se fija en onBegin()
    this.runStartMs = 0
    // Inicio de cada test (testCounter -> testStartMs) para estampar el capítulo
    this.testStartMs = new Map()
  }

  onBegin(config) {
    const project = config.projects?.[0]
    const browserName = project?.use?.browserName ?? 'chromium'
    this.runStartMs = Date.now()
    const event = {
      type: 'env',
      navegador: browserName,
      sistemaOperativo: this._detectOS(),
      nodoEjecucion: this._detectHostname(),
      runStartMs: this.runStartMs,
    }
    this._emit(event)
  }

  onTestBegin(test) {
    this.testCounter++
    this.substepCounters.set(this.testCounter, 0)
    // Offset del test desde el inicio de la corrida, para emitir videoInicioMs
    this.testStartMs.set(this.testCounter, Date.now())
  }

  onStepEnd(test, result, step) {
    if (!this._isMeaningfulStep(step)) return

    // Evento assertion para los expect (conteo ok/fail)
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
    }

    // También se emite substep para el acordeón
    this._emitSubstep(test, step)
  }

  // Descarta hooks, fixtures y steps anidados en ellos; cada hijo llega a onStepEnd por su cuenta
  _isMeaningfulStep(step) {
    if (step.category === 'hook' || step.category === 'fixture' || step.category === 'test.attach') {
      return false
    }
    let ancestor = step.parent
    while (ancestor) {
      if (ancestor.category === 'hook' || ancestor.category === 'fixture') return false
      ancestor = ancestor.parent
    }
    return true
  }

  // Emite un evento substep
  _emitSubstep(test, step) {
    const parentTestId = this.testCounter
    const prev = this.substepCounters.get(parentTestId) ?? 0
    const numero = prev + 1
    this.substepCounters.set(parentTestId, numero)

    const estado = step.error ? 'fallo' : 'paso'

    // Extrae captura actual y referencia de los attachments
    const { capturaActualPath, capturaReferenciaPath } = this._extractCapturePaths(step.attachments || [])

    const substepEvent = {
      type: 'substep',
      parentTestId,
      numero,
      tipo: this._classifyStepType(step.category, step.title),
      descripcion: step.title,
      estado,
      duracionMs: step.duration,
      errorMsg: step.error ? this._extractErrorMsg(step.error) : null,
      capturaActualPath,
      capturaReferenciaPath,
    }
    this._emit(substepEvent)
  }

  // Extrae captura actual y referencia de los attachments de un step (foo-actual/expected/diff.png)
  _extractCapturePaths(attachments) {
    // Acepta contentType de imagen o extensión .png/.webp (Playwright a veces no setea contentType)
    const imageAttachments = attachments.filter(a => {
      if (a.path && /\.(png|webp)$/i.test(a.path)) return true
      if (a.contentType?.startsWith('image/')) return true
      return false
    })

    if (imageAttachments.length === 0) {
      return { capturaActualPath: null, capturaReferenciaPath: null }
    }

    // Busca por nombre de attachment y por path (foo-actual.png, foo-expected.png, foo-diff.png)
    const actual = imageAttachments.find(a =>
      /actual/i.test(a.name) || (a.path && /actual/i.test(a.path))
    )
    const expected = imageAttachments.find(a =>
      /expected|reference/i.test(a.name) || (a.path && /expected|reference/i.test(a.path))
    )

    // Si hay actual+expected, se usan ambos
    if (actual && expected) {
      return {
        capturaActualPath: actual.path ?? null,
        capturaReferenciaPath: expected.path ?? null,
      }
    }

    // Si no, el primero es actual y el segundo la referencia
    return {
      capturaActualPath: imageAttachments[0].path ?? null,
      capturaReferenciaPath: imageAttachments.length > 1 ? (imageAttachments[1].path ?? null) : null,
    }
  }

  // Clasifica el tipo de step según categoría y título.
  // Clasifica el step por categoría y título; 'hook' no llega acá
  _classifyStepType(category, title) {
    if (category === 'expect') return 'assertion'
    const t = (title || '').toLowerCase()
    if (t.includes('navigate') || t.includes('goto') || t.includes('visit')) return 'navigate'
    if (t.includes('click') || t.includes('fill') || t.includes('type') || t.includes('press') || t.includes('select') || t.includes('check')) return 'action'
    return 'other'
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

    // Timestamps del capítulo de video: inicio = testStartMs - runStartMs, fin = inicio + result.duration
    const testStart = this.testStartMs.get(this.testCounter) ?? Date.now()
    const videoInicioMs = Math.max(0, testStart - this.runStartMs)
    const videoFinMs = videoInicioMs + (result.duration ?? 0)
    // El inicio de este test ya no se necesita
    this.testStartMs.delete(this.testCounter)

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
      videoInicioMs,
      videoFinMs,
    }
    this._emit(event)

    // Evento captura-test con las imágenes de nivel test (vienen en result.attachments)
    const testAttachments = (result.attachments || []).filter(a => {
      if (a.path && /\.(png|webp)$/i.test(a.path)) return true
      if (a.contentType?.startsWith('image/')) return true
      return false
    })

    if (testAttachments.length > 0) {
      const capturaPaths = this._extractCapturePaths(testAttachments)
      const capturaTestEvent = {
        type: 'captura-test',
        parentTestId: this.testCounter,
        capturaActualPath: capturaPaths.capturaActualPath,
        capturaReferenciaPath: capturaPaths.capturaReferenciaPath,
      }
      this._emit(capturaTestEvent)
    }
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
    // Escapa los \n del JSON para no romper el parseo línea a línea del runner
    const json = JSON.stringify(event).replace(/\n/g, '\\n')
    process.stdout.write(json + '\n')
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
}

module.exports = JsonReporter
