// src/execution/runner.spec.ts
// Two groups:
//  1. `parseReporterEvent` — ported verbatim from
//     vortest-web/__tests__/lib/worker/parse-reporter-event.test.ts (pure
//     function, only the import path changed).
//  2. `runPlaywrightTest` — NEW tests for the ported runner's event-emission
//     behavior. The original vortest-web/__tests__/lib/worker/runner.test.ts
//     mocked `prisma`/`@/lib/db` throughout; since this engine has zero DB
//     knowledge (prisma.* calls became eventsPublisher.emit* calls), those
//     DB-shaped assertions don't carry over 1:1. These tests mock
//     EventsPublisherService/ArtifactsService instead and assert the same
//     state-mapping/timeout/cancellation behavior against the new contract.
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  EjecucionCanceladaError,
  parseReporterEvent,
  runPlaywrightTest,
  type RunnerDeps,
} from './runner'

jest.mock('child_process')

const killProcessTreeMock = jest.fn().mockResolvedValue(undefined)
jest.mock('./kill-tree', () => ({
  killProcessTree: (...args: unknown[]) => killProcessTreeMock(...args),
}))

function mockProcess(opts: { stdoutData?: string; exitCode?: number | null; error?: Error }) {
  const proc: any = {
    stdout: {
      on: jest.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && opts.stdoutData) {
          cb(Buffer.from(opts.stdoutData))
        }
      }),
    },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: (arg: unknown) => void) => {
      if (event === 'close' && opts.exitCode !== undefined && opts.exitCode !== null) {
        cb(opts.exitCode)
      }
      if (event === 'error' && opts.error) {
        cb(opts.error)
      }
    }),
    kill: jest.fn(),
    pid: 12345,
  }
  ;(spawn as jest.Mock).mockReturnValue(proc)
  return proc
}

function makeDeps(): RunnerDeps & {
  eventsPublisher: {
    emitEnv: jest.Mock
    emitStep: jest.Mock
    emitSubstep: jest.Mock
    emitLog: jest.Mock
    emitAssertion: jest.Mock
    emitCapturaTest: jest.Mock
  }
  artifactsService: { uploadArtifact: jest.Mock }
} {
  return {
    eventsPublisher: {
      emitEnv: jest.fn(),
      emitStep: jest.fn(),
      emitSubstep: jest.fn(),
      emitLog: jest.fn(),
      emitAssertion: jest.fn(),
      emitCapturaTest: jest.fn(),
    },
    artifactsService: {
      uploadArtifact: jest.fn().mockResolvedValue({ artefactoId: 'artefacto-1', deduplicated: false }),
    },
  }
}

describe('parseReporterEvent — 6 event types (HU-4.5)', () => {
  it('parsea evento env', () => {
    const event = parseReporterEvent(
      JSON.stringify({ type: 'env', navegador: 'chromium', sistemaOperativo: 'Linux', nodoEjecucion: 'host' }),
    )
    expect(event).toEqual({
      type: 'env',
      navegador: 'chromium',
      sistemaOperativo: 'Linux',
      nodoEjecucion: 'host',
    })
  })

  it('parsea evento step con nuevos campos', () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: 'step',
        numero: 1,
        descripcion: 'Test',
        estado: 'paso',
        duracionMs: 100,
        selfHealed: false,
        errorMsg: null,
        resultadoEsperado: 'Debe cargar',
        resultadoObtenido: null,
        errorCount: 0,
      }),
    )
    expect(event).toMatchObject({ type: 'step', numero: 1, resultadoEsperado: 'Debe cargar', errorCount: 0 })
  })

  it('parsea evento substep', () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: 'substep',
        parentTestId: 1,
        numero: 1,
        tipo: 'action',
        descripcion: 'Click',
        estado: 'paso',
        duracionMs: 50,
        errorMsg: null,
      }),
    )
    expect(event).toMatchObject({ type: 'substep', parentTestId: 1, tipo: 'action' })
  })

  it('parsea evento log', () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: 'log',
        parentTestId: 1,
        parentSubstepId: null,
        ts: '2026-08-20T10:00:00Z',
        level: 'error',
        msg: 'boom',
        source: 'page',
      }),
    )
    expect(event).toMatchObject({ type: 'log', level: 'error', msg: 'boom' })
  })

  it('parsea evento assertion', () => {
    const event = parseReporterEvent(
      JSON.stringify({ type: 'assertion', parentTestId: 1, descripcion: 'is visible', ok: true }),
    )
    expect(event).toMatchObject({ type: 'assertion', ok: true })
  })

  it('parsea evento end con aserciones', () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: 'end',
        estado: 'paso',
        duracionMs: 5000,
        asercionesTotal: 10,
        asercionesOk: 9,
        asercionesFail: 1,
      }),
    )
    expect(event).toMatchObject({ type: 'end', asercionesTotal: 10, asercionesFail: 1 })
  })

  it('retorna null para JSON sin campo type', () => {
    const event = parseReporterEvent(JSON.stringify({ numero: 1, descripcion: 'Test' }))
    expect(event).toBeNull()
  })

  it('retorna null para type desconocido', () => {
    const event = parseReporterEvent(JSON.stringify({ type: 'unknown', data: 'x' }))
    expect(event).toBeNull()
  })

  it('retorna null para línea no-JSON', () => {
    expect(parseReporterEvent('not json')).toBeNull()
  })
})

describe('runPlaywrightTest — state mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('emite eventos step con estado normalizado "paso" y resuelve passed=true', async () => {
    const deps = makeDeps()
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234,"selfHealed":false,"errorMsg":null}\n' +
        '{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"paso","duracionMs":567,"selfHealed":false,"errorMsg":null}\n',
      exitCode: 0,
    })

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })

    expect(result.passed).toBe(true)
    expect(result.hasUnhealedFailure).toBe(false)
    expect(result.pasoNumero).toBe(2)
    expect(deps.eventsPublisher.emitStep).toHaveBeenCalledTimes(2)
  })

  it('inyecta VORTEST_OUTPUT_DIR en el env del spawn', async () => {
    const deps = makeDeps()
    mockProcess({ exitCode: 0 })

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })

    expect(result.outputDir).toBeDefined()
    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({ VORTEST_OUTPUT_DIR: expect.any(String) }),
      }),
    )
    const spawnCall = (spawn as jest.Mock).mock.calls[0]
    const env = spawnCall[2].env
    expect(env.VORTEST_OUTPUT_DIR).toContain('job-1')
  })

  it('marca hasUnhealedFailure=true cuando un paso falla sin selfHeal', async () => {
    const deps = makeDeps()
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Click en boton","estado":"fallo","duracionMs":1000,"errorMsg":"Timeout 30000ms"}\n',
      exitCode: 1,
    })

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })

    expect(result.passed).toBe(false)
    expect(result.hasUnhealedFailure).toBe(true)
    expect(deps.eventsPublisher.emitStep).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ estado: 'fallo', errorMsg: 'Timeout 30000ms' }),
    )
  })

  it('no marca hasUnhealedFailure cuando el paso fallido tiene selfHealed=true', async () => {
    const deps = makeDeps()
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Click en boton","estado":"fallo","duracionMs":1000,"selfHealed":true}\n',
      exitCode: 0,
    })

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
    expect(result.hasUnhealedFailure).toBe(false)
  })

  it('ignora líneas que no son JSON válido', async () => {
    const deps = makeDeps()
    mockProcess({
      stdoutData:
        'Some warning log\n' +
        '{"type":"step","numero":1,"descripcion":"Test step","estado":"paso","duracionMs":500}\n' +
        'Another non-JSON line\n',
      exitCode: 0,
    })

    await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
    expect(deps.eventsPublisher.emitStep).toHaveBeenCalledTimes(1)
  })

  it('preserva selfHealed=true en el evento emitido', async () => {
    const deps = makeDeps()
    mockProcess({
      stdoutData: '{"type":"step","numero":1,"descripcion":"Test paso","estado":"paso","duracionMs":800,"selfHealed":true}\n',
      exitCode: 0,
    })

    await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
    expect(deps.eventsPublisher.emitStep).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ selfHealed: true }),
    )
  })

  it('rechaza con error cuando Playwright sale con código no esperado', async () => {
    const deps = makeDeps()
    mockProcess({ exitCode: 2 })

    await expect(runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })).rejects.toThrow(
      /Playwright exited with code 2/,
    )
  })

  it('reporta pasoNumero=0 cuando el script no genera ningún step', async () => {
    const deps = makeDeps()
    mockProcess({ exitCode: 0 })

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
    expect(result.pasoNumero).toBe(0)
  })

  describe('HU-G18 — videoInicioMs / videoFinMs chapter timestamps', () => {
    it('reenvía los timestamps de capítulo emitidos por el reporter', async () => {
      const deps = makeDeps()
      mockProcess({
        stdoutData:
          '{"type":"step","numero":1,"descripcion":"Login","estado":"paso","duracionMs":2000,"videoInicioMs":500,"videoFinMs":2500}\n',
        exitCode: 0,
      })

      await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
      expect(deps.eventsPublisher.emitStep).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ videoInicioMs: 500, videoFinMs: 2500 }),
      )
    })

    it('reenvía null cuando el reporter no emite timestamps (backwards compat)', async () => {
      const deps = makeDeps()
      mockProcess({
        stdoutData: '{"type":"step","numero":1,"descripcion":"Legacy","estado":"paso","duracionMs":2000}\n',
        exitCode: 0,
      })

      await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
      expect(deps.eventsPublisher.emitStep).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ videoInicioMs: null, videoFinMs: null }),
      )
    })
  })

  it('sube capturas referenciadas por un substep y emite el Token (artefactoId), no el path', async () => {
    const deps = makeDeps()
    const capturaPath = path.join(os.tmpdir(), `runner-substep-captura-${Date.now()}.png`)
    fs.writeFileSync(capturaPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Test","estado":"paso","duracionMs":100}\n' +
        `{"type":"substep","parentTestId":1,"numero":1,"tipo":"assertion","descripcion":"toHaveScreenshot","estado":"paso","duracionMs":50,"capturaActualPath":${JSON.stringify(capturaPath)}}\n`,
      exitCode: 0,
    })

    try {
      await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })

      expect(deps.artifactsService.uploadArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job-1', filePath: capturaPath, tipo: 'captura' }),
      )
      expect(deps.eventsPublisher.emitSubstep).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ capturaActualToken: 'artefacto-1', capturaReferenciaToken: null }),
      )
    } finally {
      fs.unlinkSync(capturaPath)
    }
  })

  it('marca artifactUploadFailed cuando la subida de una captura falla', async () => {
    const deps = makeDeps()
    deps.artifactsService.uploadArtifact.mockResolvedValue(null)
    const capturaPath = path.join(os.tmpdir(), `runner-upload-fail-${Date.now()}.png`)
    fs.writeFileSync(capturaPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Test","estado":"paso","duracionMs":100}\n' +
        `{"type":"substep","parentTestId":1,"numero":1,"tipo":"action","descripcion":"click","estado":"paso","duracionMs":50,"capturaActualPath":${JSON.stringify(capturaPath)}}\n`,
      exitCode: 0,
    })

    try {
      const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 60_000 })
      expect(result.artifactUploadFailed).toBe(true)
    } finally {
      fs.unlinkSync(capturaPath)
    }
  })
})

describe('runPlaywrightTest — timeout configurable (job.timeoutMs)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('usa el timeoutMs del job en vez de un valor hardcodeado', async () => {
    const deps = makeDeps()
    const closeHandlers: Array<(code: number | null) => void> = []
    const proc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === 'close') closeHandlers.push(cb as (code: number | null) => void)
      }),
      kill: jest.fn(),
      pid: 12345,
    }
    ;(spawn as jest.Mock).mockReturnValue(proc)

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })

    const promise = runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, { timeoutMs: 5_000 })
    // Evita un unhandled-rejection ruidoso mientras seguimos avanzando
    // timers — el valor real se verifica más abajo, después de settlear.
    promise.catch(() => undefined)

    // Antes del timeout configurado, no debería haberse intentado matar el proceso
    await jest.advanceTimersByTimeAsync(4_000)
    expect(killProcessTreeMock).not.toHaveBeenCalled()

    // Al llegar a los 5s configurados (no a los 10 min hardcodeados del
    // original), el timeout global dispara y empieza a matar el proceso —
    // esto es lo que demuestra que `job.timeoutMs` es respetado.
    await jest.advanceTimersByTimeAsync(1_500)
    expect(killProcessTreeMock).toHaveBeenCalledWith(12345, false)

    // Simula que el proceso efectivamente murió tras el kill — deja que la
    // rama del handler 'close' settlee la promesa en vez de recorrer el resto
    // del flujo de gracia/force-kill (fuera de foco para este test).
    for (const h of closeHandlers) h(143)
    await jest.runOnlyPendingTimersAsync()

    await expect(promise).rejects.toThrow(/Playwright exited with code 143/)

    jest.useRealTimers()
  })
})

describe('runPlaywrightTest — cancelación push-based vía AbortSignal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rechaza con EjecucionCanceladaError cuando el AbortSignal se dispara', async () => {
    const deps = makeDeps()
    const closeHandlers: Array<(code: number | null) => void> = []
    const proc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === 'close') closeHandlers.push(cb as (code: number | null) => void)
      }),
      kill: jest.fn(),
      pid: 12345,
    }
    ;(spawn as jest.Mock).mockReturnValue(proc)

    const abortController = new AbortController()

    const promise = runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, {
      timeoutMs: 60_000,
      abortSignal: abortController.signal,
    })

    // El controller HTTP (no el runner) es quien mata el proceso — acá solo
    // simulamos que el proceso terminó luego de que el controller lo mató.
    abortController.abort()
    expect(killProcessTreeMock).not.toHaveBeenCalled() // el runner ya no mata nada por sí mismo

    for (const h of closeHandlers) h(143)

    await expect(promise).rejects.toBeInstanceOf(EjecucionCanceladaError)
    await expect(promise).rejects.toThrow(/cancelado/)
  })

  it('no rechaza como cancelado si el AbortSignal nunca se dispara', async () => {
    const deps = makeDeps()
    mockProcess({ exitCode: 0 })
    const abortController = new AbortController()

    const result = await runPlaywrightTest('/tmp/test.spec.ts', 'job-1', deps, {
      timeoutMs: 60_000,
      abortSignal: abortController.signal,
    })

    expect(result.passed).toBe(true)
  })
})
