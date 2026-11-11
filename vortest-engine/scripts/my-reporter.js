// Reporter de Playwright: emite eventos JSON por stdout para runner.ts
// Solo emite substeps de acciones reales: descarta hooks, fixtures y sus hijos

// El valor tecleado en campos de clave termina en la UI y en el Acta: se enmascara antes de emitirlo.
const CAMPO_SENSIBLE = /pass|contrase|clave|secret|token|\bpin|\botp|cvv/i
const ACCION_CON_VALOR = /^(Fill|Type|Press sequentially) "(.*)" ((?:locator|getBy\w+|frameLocator)\(.*)$/s

function enmascararValorSensible(titulo) {
  const m = ACCION_CON_VALOR.exec(titulo || "")
  if (!m || !CAMPO_SENSIBLE.test(m[3])) return titulo
  return `${m[1]} "******" ${m[3]}`
}

class JsonReporter {
  constructor() {
    this.testCounter = 0
    this.substepCounters = new Map() // testCounter -> substep number
    this.assertionCounters = { total: 0, ok: 0, fail: 0 }
    // Origen de tiempo para los offsets de video por test
    this.runStartMs = 0
    // testCounter -> { testStartMs }
    this.testStartMs = new Map()
  }

  onBegin(config, suite) {
    // `config.projects[0]` es siempre el primero del config (chromium), no el que corre: el root suite solo trae los proyectos filtrados por --project.
    const project = suite?.suites?.[0]?.project?.() ?? config.projects?.[0]
    const browserName = project?.use?.browserName ?? project?.name ?? 'chromium'
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
    // Offset del test respecto al inicio de la corrida
    this.testStartMs.set(this.testCounter, Date.now())
  }

  onStepEnd(test, result, step) {
    if (!this._isMeaningfulStep(step)) return

    // Evento assertion para steps expect (conteo ok/fail)
    if (step.category === 'expect') {
      this.assertionCounters.total++
      const ok = !step.error
      if (ok) this.assertionCounters.ok++
      else this.assertionCounters.fail++

      const assertionEvent = {
        type: 'assertion',
        parentTestId: this.testCounter,
        descripcion: enmascararValorSensible(step.title),
        ok,
      }
      this._emit(assertionEvent)
    }

    // También emitimos substep para que aparezca en el acordeón
    this._emitSubstep(test, step)
  }

  // Descarta hooks, fixtures y steps anidados en ellos
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

    // Extraer captura actual y referencia de los attachments
    const { capturaActualPath, capturaReferenciaPath } = this._extractCapturePaths(step.attachments || [])

    const substepEvent = {
      type: 'substep',
      parentTestId,
      numero,
      tipo: this._classifyStepType(step.category, step.title),
      descripcion: enmascararValorSensible(step.title),
      estado,
      duracionMs: step.duration,
      errorMsg: step.error ? this._extractErrorMsg(step.error) : null,
      capturaActualPath,
      capturaReferenciaPath,
    }
    this._emit(substepEvent)
  }

  // Extrae captura actual y referencia de los attachments de un step
  // toHaveScreenshot genera: foo-actual.png, foo-expected.png, foo-diff.png
  _extractCapturePaths(attachments) {
    // Acepta contentType de imagen o extensiones .png/.webp (Playwright no siempre lo setea)
    const imageAttachments = attachments.filter(a => {
      if (a.path && /\.(png|webp)$/i.test(a.path)) return true
      if (a.contentType?.startsWith('image/')) return true
      return false
    })

    if (imageAttachments.length === 0) {
      return { capturaActualPath: null, capturaReferenciaPath: null }
    }

    // Busca por nombre de attachment y por path
    const actual = imageAttachments.find(a =>
      /actual/i.test(a.name) || (a.path && /actual/i.test(a.path))
    )
    const expected = imageAttachments.find(a =>
      /expected|reference/i.test(a.name) || (a.path && /expected|reference/i.test(a.path))
    )

    // Si encontramos actual+expected, usar ambos
    if (actual && expected) {
      return {
        capturaActualPath: actual.path ?? null,
        capturaReferenciaPath: expected.path ?? null,
      }
    }

    // Caso contrario usar el primero como actual, segundo como referencia
    return {
      capturaActualPath: imageAttachments[0].path ?? null,
      capturaReferenciaPath: imageAttachments.length > 1 ? (imageAttachments[1].path ?? null) : null,
    }
  }

  // Clasifica el tipo de step según categoría y título
  _classifyStepType(category, title) {
    if (category === 'expect') return 'assertion'
    const t = (title || '').toLowerCase()
    if (t.includes('navigate') || t.includes('goto') || t.includes('visit')) return 'navigate'
    if (t.includes('click') || t.includes('fill') || t.includes('type') || t.includes('press') || t.includes('select') || t.includes('check')) return 'action'
    return 'other'
  }

  onTestEnd(test, result) {
    let estado

    if (result.status === 'passed') {
      estado = 'paso'
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

    // Offsets del capítulo de video: inicio = testStartMs - runStartMs, fin = inicio + result.duration
    const testStart = this.testStartMs.get(this.testCounter) ?? Date.now()
    const videoInicioMs = Math.max(0, testStart - this.runStartMs)
    const videoFinMs = videoInicioMs + (result.duration ?? 0)
    // El inicio del test ya no se necesita
    this.testStartMs.delete(this.testCounter)

    const event = {
      type: 'step',
      numero: this.testCounter,
      descripcion: test.title,
      estado,
      duracionMs: result.duration,
      errorMsg,
      resultadoEsperado,
      resultadoObtenido,
      errorCount,
      videoInicioMs,
      videoFinMs,
    }
    this._emit(event)

    // Evento captura-test con las imágenes de nivel test (result.attachments)
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
    // Prefijo centinela para que runner.ts ignore otro stdout; se sanean los saltos de línea del JSON
    const json = JSON.stringify(event).replace(/\n/g, '\\n')
    process.stdout.write('__VORTEST__' + json + '\n')
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
    const raw = typeof error === 'string' ? error : (error.message ?? error.toString?.() ?? null)
    // Playwright colorea expect() aunque FORCE_COLOR=0; se quitan los escapes ANSI
    // eslint-disable-next-line no-control-regex
    return raw == null ? null : raw.replace(/\u001b\[[0-9;]*m/g, '')
  }
}

module.exports = JsonReporter
module.exports.enmascararValorSensible = enmascararValorSensible
