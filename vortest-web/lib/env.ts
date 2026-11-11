/** Validación de variables de entorno con zod por proceso (web, consumer, recorder): `env` es perezoso y permisivo, `validateEnv` es el fail-fast. */
import { z } from "zod";

/** Trata "" como no definida (típico en `.env` con `VAR=`), y hace opcional. */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const laxSchema = z.object({
  DATABASE_URL: opt(z.string()),
  SESSION_SECRET: opt(z.string()),
  SEED_ADMIN_PASSWORD: opt(z.string()),
  // Clave de cifrado de credenciales
  CREDENCIALES_ENCRYPTION_KEY: opt(z.string()),

  RABBITMQ_URL: opt(z.string()),
  ENGINE_INTERNAL_SECRET: opt(z.string()),
  ENGINE_INTERNAL_URL: opt(z.string()),
  EJECUCION_TIMEOUT_MS: opt(z.coerce.number().int().positive()),

  // Health check del execution-consumer
  CONSUMER_HEALTH_PORT: opt(z.coerce.number().int().min(0).max(65535)),

  RECORDER_INTERNAL_SECRET: opt(z.string()),
  RECORDER_INTERNAL_URL: opt(z.string()),
  RECORDER_PUBLIC_URL: opt(z.string()),
  RECORDER_WS_PORT: opt(z.coerce.number().int().positive()),
  RECORDER_MAX_SESSIONS: opt(z.coerce.number().int().positive()),
  RECORDER_HEARTBEAT_TIMEOUT_MS: opt(z.coerce.number().int().positive()),

  SESIONES_RETENTION_DAYS: opt(z.coerce.number().int().positive()),

  NODE_ENV: opt(z.enum(["development", "test", "production"])),
});

export type Env = z.infer<typeof laxSchema>;

/** Lectura tipada y perezosa de `process.env`. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    return laxSchema.parse(process.env)[prop as keyof Env];
  },
});

export type EnvProcess = "web" | "consumer" | "recorder";

const requiredByProcess: Record<EnvProcess, z.ZodType> = {
  web: z.object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    RABBITMQ_URL: z.string().min(1),
    ENGINE_INTERNAL_SECRET: z.string().min(16),
    ENGINE_INTERNAL_URL: z.string().url(),
    RECORDER_INTERNAL_SECRET: z.string().min(16),
  }),
  consumer: z.object({
    DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.string().min(1),
  }),
  recorder: z.object({
    DATABASE_URL: z.string().min(1),
    RECORDER_INTERNAL_SECRET: z.string().min(16),
  }),
};

/** Fail-fast al arrancar un proceso: lanza si falta o es inválida alguna variable; el mensaje lista solo nombres, nunca valores. */
export function validateEnv(proceso: EnvProcess): void {
  const problems: string[] = [];

  const strict = requiredByProcess[proceso].safeParse(process.env);
  if (!strict.success) {
    for (const issue of strict.error.issues) {
      problems.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }
  const lax = laxSchema.safeParse(process.env);
  if (!lax.success) {
    for (const issue of lax.error.issues) {
      problems.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Variables de entorno inválidas para el proceso "${proceso}":\n  - ${problems.join("\n  - ")}`
    );
  }
}
