// Valida que el script sea ejecutable antes de escribirlo a archivo temporal
export function validateScript(script: string, scriptFileName: string | null): { valid: boolean; error?: string } {
  if (!script || script.trim() === '') {
    return { valid: false, error: 'Script vacío o no proporcionado' }
  }

  if (scriptFileName) {
    const lower = scriptFileName.toLowerCase();
    if (!lower.endsWith('.spec.ts') && !lower.endsWith('.test.ts') && !lower.endsWith('.spec.js') && !lower.endsWith('.test.js')) {
      return { valid: false, error: `Extensión inválida. Debe ser .spec.ts, .test.ts, .spec.js o .test.js` }
    }
  }

  return { valid: true }
}
