import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

describe('execution/storage-state', () => {
  // Se cambia el cwd al tmpDir antes de requerir el módulo, que calcula RUNTIME_DIR al importarse
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vortest-engine-storage-'))
  const originalCwd = process.cwd()

  let mod: typeof import('./storage-state')

  beforeAll(() => {
    process.chdir(tmpDir)
    jest.isolateModules(() => {
      mod = require('./storage-state')
    })
  })

  afterAll(() => {
    process.chdir(originalCwd)
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  beforeEach(() => {
    const runtimeDir = path.join(tmpDir, 'runtime', 'storage-state')
    if (fs.existsSync(runtimeDir)) {
      fs.rmSync(runtimeDir, { recursive: true, force: true })
    }
  })

  it('ensureRuntimeDir crea el directorio runtime/storage-state', () => {
    expect(fs.existsSync(path.join(tmpDir, 'runtime', 'storage-state'))).toBe(false)
    mod.ensureRuntimeDir()
    expect(fs.existsSync(path.join(tmpDir, 'runtime', 'storage-state'))).toBe(true)
  })

  it('getStorageStatePath retorna la ruta esperada', () => {
    const p = mod.getStorageStatePath('job-1')
    expect(p).toBe(path.join(tmpDir, 'runtime', 'storage-state', 'job-1.json'))
  })

  it('writeStorageState escribe JSON pretty al archivo', () => {
    mod.writeStorageState('job-2', { cookies: [{ name: 'x' }], origins: [] })
    const filePath = path.join(tmpDir, 'runtime', 'storage-state', 'job-2.json')
    expect(fs.existsSync(filePath)).toBe(true)
    const contents = fs.readFileSync(filePath, 'utf-8')
    expect(contents).toContain('"cookies"')
    expect(contents).toContain('"origins"')
    expect(contents).toMatch(/\{\n\s+"/)
  })

  it('writeStorageState con null/undefined escribe un shell por defecto', () => {
    mod.writeStorageState('job-3', null)
    const parsed = mod.readStorageState('job-3') as { cookies: unknown[]; origins: unknown[] }
    expect(parsed).toEqual({ cookies: [], origins: [] })
  })

  it('readStorageState retorna null si el archivo no existe', () => {
    expect(mod.readStorageState('nope')).toBeNull()
  })

  it('readStorageState parsea JSON válido', () => {
    mod.writeStorageState('job-4', { cookies: [{ name: 'session', value: 'abc' }] })
    const result = mod.readStorageState('job-4')
    expect(result).toEqual({ cookies: [{ name: 'session', value: 'abc' }] })
  })

  it('readStorageState retorna null si el JSON está corrupto', () => {
    mod.ensureRuntimeDir()
    const filePath = path.join(tmpDir, 'runtime', 'storage-state', 'job-broken.json')
    fs.writeFileSync(filePath, 'no es json {')
    expect(mod.readStorageState('job-broken')).toBeNull()
  })

  it('cleanupStorageState elimina el archivo', () => {
    mod.writeStorageState('job-5', { cookies: [] })
    const filePath = path.join(tmpDir, 'runtime', 'storage-state', 'job-5.json')
    expect(fs.existsSync(filePath)).toBe(true)
    mod.cleanupStorageState('job-5')
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('cleanupStorageState no lanza si el archivo no existe', () => {
    expect(() => mod.cleanupStorageState('no-existe')).not.toThrow()
  })
})
