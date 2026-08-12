// Valida que el script sea ejecutable antes de escribirlo a archivo temporal
export function validateScript(script: string, scriptFileName: string | null): { valid: boolean; error?: string } {
  if (!script || script.trim() === '') {
    return { valid: false, error: 'Script vacío o no proporcionado' }
  }

  if (scriptFileName) {
    if (!scriptFileName.endsWith('.spec.ts') && !scriptFileName.endsWith('.test.ts')) {
      return { valid: false, error: `Extensión inválida. Debe ser .spec.ts o .test.ts` }
    }
  }

  return { valid: true }
}
