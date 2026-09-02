// Reporter custom para Playwright — emite eventos JSON por stdout para que el
// worker los parsee e inserte como PasoEjecucion / PasoSubaccion.
//
// Emite 5 tipos de evento directamente:
//   env, step, substep, assertion, end
// Los eventos 'log' se emiten vía fixture global (ver lib/fixtures/log-capture.ts)
//
// NOTA: Playwright Reporter API requiere una Clase.
//
// HU-4.6: Captura TODAS las categorías de TestStep de Playwright:
// expect, test.step, pw:api, hook, fixture, test.attach
// Además hace walk recursivo en step.steps[] para capturar sub-steps anidados.
// Las categorías 'fixture' y 'test.attach' se skippean (ruido/no relevantes).

class JsonReporter {
  constructor() {
    this.testCounter = 0
    this.substepCounters = new Map() // testCounter -> substep number
    this.assertionCounters = { total: 0, ok: 0, fail: 0 }
    // HU-G18 — wall-clock origin for video chapter timestamps. Captured
    // in onBegin() so each test can compute its offset from the run start
    // (≈ when Playwright began recording video). The runner stores these
    // as PasoEjecucion.videoInicioMs/videoFinMs and the UI uses them to
    // build the segmented chapter bar.
    this.runStartMs = 0
    // Map<testCounter, { testStartMs }> — captured in onTestBegin so we
    // can stamp the chapter start without depending on Date drift across
    // the worker ↔ runner boundary.
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
    // HU-G18 — capture the per-test offset from run start so onTestEnd
    // can emit videoInicioMs without a second Date.now() race.
    this.testStartMs.set(this.testCounter, Date.now())
  }

  onStepEnd(test, result, step) {
    // emit assertion event for expect steps (accounting de ok/fail)
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
      // También emitimos substep para que aparezca en el acordeón
      this._emitSubstep(test, step)
      // Walk recursivo por si hay steps anidados
      this._walkStepSteps(test, step)
      return
    }

    // Skip 'fixture' (metadata interno) y 'test.attach' (metadata de attachment)
    if (step.category === 'fixture' || step.category === 'test.attach') return

    // hook, pw:api, test.step → emitimos substep
    this._emitSubstep(test, step)
    // Walk recursivo por si hay steps anidados
    this._walkStepSteps(test, step)
  }

  // Walk recursivo por step.steps[] (sub-steps anidados de Playwright)
  _walkStepSteps(test, step) {
    if (!step.steps || step.steps.length === 0) return
    for (const childStep of step.steps) {
      this._emitSubstep(test, childStep)
      this._walkStepSteps(test, childStep)
    }
  }

  // Helper para emitir un evento substep
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
      descripcion: step.title,
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
    // Aceptar tanto contentType de imagen como extensiones de archivo .png/.webp
    // Playwright a veces no setea contentType correctamente en attachments
    const imageAttachments = attachments.filter(a => {
      if (a.path && /\.(png|webp)$/i.test(a.path)) return true
      if (a.contentType?.startsWith('image/')) return true
      return false
    })

    if (imageAttachments.length === 0) {
      return { capturaActualPath: null, capturaReferenciaPath: null }
    }

    // Buscar por nombre de attachment (name) y por path
    // toHaveScreenshot naming: foo-actual.png, foo-expected.png, foo-diff.png
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
    if (category === 'hook') return 'setup'
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

    // HU-G18 — chapter timestamps for the video bar. We use
    // (testStartMs - runStartMs) as the start of the chapter, and add
    // result.duration (Playwright-measured test wall-clock) to derive the
    // end. If Playwright setup eats some time between tests (project
    // fixtures, retries), that gap is silently rolled into the *next*
    // chapter start — visually correct since the user sees the gap as
    // blank screen, which is exactly what the segment width would imply.
    const testStart = this.testStartMs.get(this.testCounter) ?? Date.now()
    const videoInicioMs = Math.max(0, testStart - this.runStartMs)
    const videoFinMs = videoInicioMs + (result.duration ?? 0)
    // After emit, this test's start is no longer needed.
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

    // Emitir evento captura-test con las imágenes de nivel test (screenshot: 'on')
    // Estas capturas vienen en result.attachments, no en step.attachments
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
}

module.exports = JsonReporter
