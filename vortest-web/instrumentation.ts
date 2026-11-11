// Valida el entorno al arrancar el servidor; se omite en next build
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { validateEnv } = await import('./lib/env')
  validateEnv('web')
}
