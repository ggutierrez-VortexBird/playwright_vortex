// Reporter custom para Playwright — emite eventos JSON por stdout para que el
// worker los parsee e inserte como PasoEjecucion.
//
// NOTA: Playwright Reporter API requiere una Clase (no objeto plano).
// Design decision: emitimos un evento por cada TEST que termina (no por step individual).
// El runner.ts parsea estos eventos y los inserta como PasoEjecucion.
// AC-9/10/11 se cumplen a nivel de "cada test termina" en vez de "cada step".

class JsonReporter {
  onTestEnd(test, result) {
    let estado
    let selfHealed = false

    if (result.status === 'passed') {
      // Test pasó — pero pudo haber tenido pasos "reparados" (flaky)
      selfHealed = result.errors.length > 0
      estado = 'paso'
    } else if (result.status === 'failed') {
      estado = 'fallo'
      selfHealed = false
    } else if (result.status === 'skipped') {
      estado = 'paso'
      selfHealed = false
    } else {
      // timedOut, interrupted, catalogued — treated as failure
      estado = 'fallo'
    }

    const event = {
      type: 'step',
      descripcion: test.title,
      estado,
      duracionMs: result.duration,
      selfHealed,
      errorMsg:
        result.errors.length > 0
          ? `${result.errors.length} error(es) en test`
          : null,
    }
    process.stdout.write(JSON.stringify(event) + '\n')
  }

  onEnd(result) {
    const event = {
      type: 'end',
      estado:
        result.status === 'passed'
          ? 'paso'
          : result.status === 'failed'
            ? 'fallo'
            : 'error',
      duracionMs: result.duration,
    }
    process.stdout.write(JSON.stringify(event) + '\n')
  }
}

module.exports = JsonReporter