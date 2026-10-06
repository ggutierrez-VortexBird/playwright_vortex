// [CFG-01] Next.js ejecuta `register()` una vez al arrancar el servidor.
// Validamos el entorno del proceso web para fallar rápido en el boot en vez
// de a mitad de una request. Se omite durante `next build`, donde las
// variables de runtime pueden no estar presentes.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { validateEnv } = await import('./lib/env')
  validateEnv('web')
}
