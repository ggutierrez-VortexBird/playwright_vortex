// Schema Zod de variables de entorno
import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RABBITMQ_URL: z.string().url(),
  ENGINE_INTERNAL_SECRET: z.string().min(16),
  MAIN_APP_INTERNAL_URL: z.string().url(),
  PORT: z.coerce.number().int().min(0).default(3001),
  ENGINE_MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).default(3),
  ENGINE_SHUTDOWN_GRACE_MS: z.coerce.number().int().min(0).default(0),
  PLAYWRIGHT_TIMEZONE: z.string().default('America/Bogota'),
  PLAYWRIGHT_LOCALE: z.string().default('es-CO'),
})

export type Env = z.infer<typeof envSchema>
export const parsedEnv = envSchema.parse(process.env)
