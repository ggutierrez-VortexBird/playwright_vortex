// Único módulo que conoce RabbitMQ; Nest envuelve los mensajes como `{ pattern, data }`, por eso se envuelve al publicar y se desenvuelve `.data` al consumir.
import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager'
import type { ConfirmChannel, ConsumeMessage } from 'amqplib'
import { createHash } from 'node:crypto'
import { env } from '../env'
import {
  EngineEventSchema,
  type ExecuteJobMessage,
  type EngineEvent,
  type EngineEventPayload,
} from './engine-contract'

export const EXECUTE_QUEUE = 'engine.execute'
export const EVENTS_QUEUE = 'engine.events'

/** Argumentos de `engine.execute` (quorum, delivery-limit, DLX); deben coincidir con los del motor o RabbitMQ rechaza con 406 PRECONDITION_FAILED. */
export const ENGINE_EXECUTE_QUEUE_OPTIONS = {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',
    'x-delivery-limit': 5,
    'x-dead-letter-exchange': 'engine.dlx',
  },
} as const

/** Tiempo máximo que `publishExecuteJob` espera a que haya conexión antes de fallar. */
const PUBLISH_TIMEOUT_MS = 10_000

interface NestEventEnvelope<T> {
  pattern: string
  data: T
}

function wrapNestEvent<T>(pattern: string, data: T): NestEventEnvelope<T> {
  return { pattern, data }
}

// amqp-connection-manager reconecta solo y re-ejecuta el `setup`; cacheado en globalThis para sobrevivir al hot-reload.
const globalForRabbit = globalThis as unknown as {
  __vortestRabbitConn?: AmqpConnectionManager
  __vortestRabbitPublishChannel?: ChannelWrapper
}

function getRabbitUrl(): string {
  const url = env.RABBITMQ_URL
  if (!url) {
    throw new Error('RABBITMQ_URL no está configurado')
  }
  return url
}

function getConnection(): AmqpConnectionManager {
  if (!globalForRabbit.__vortestRabbitConn) {
    const conn = amqp.connect([getRabbitUrl()], { heartbeatIntervalInSeconds: 30 })
    conn.on('connect', () => console.log('[rabbitmq] conectado'))
    conn.on('disconnect', ({ err }) => {
      console.error('[rabbitmq] desconectado, reintentando:', err?.message)
    })
    conn.on('connectFailed', ({ err }) => {
      console.error('[rabbitmq] fallo al conectar, reintentando:', err?.message)
    })
    globalForRabbit.__vortestRabbitConn = conn
  }
  return globalForRabbit.__vortestRabbitConn
}

/** true si el proceso tiene una conexión AMQP activa (lo usa el health check del consumer). */
export function isRabbitConnected(): boolean {
  return globalForRabbit.__vortestRabbitConn?.isConnected() ?? false
}

/** Canal compartido para publicar (dispararEjecucion + el consumer al despachar el hijo). */
function getPublishChannel(): ChannelWrapper {
  if (!globalForRabbit.__vortestRabbitPublishChannel) {
    globalForRabbit.__vortestRabbitPublishChannel = getConnection().createChannel({
      publishTimeout: PUBLISH_TIMEOUT_MS,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertQueue(EXECUTE_QUEUE, {
          ...ENGINE_EXECUTE_QUEUE_OPTIONS,
          arguments: { ...ENGINE_EXECUTE_QUEUE_OPTIONS.arguments },
        })
      },
    })
  }
  return globalForRabbit.__vortestRabbitPublishChannel
}

/** Publica un job a `engine.execute`; sin conexión espera hasta `PUBLISH_TIMEOUT_MS` y luego rechaza. */
export async function publishExecuteJob(message: ExecuteJobMessage): Promise<void> {
  const channel = getPublishChannel()
  const envelope = wrapNestEvent(EXECUTE_QUEUE, message)
  await channel.sendToQueue(EXECUTE_QUEUE, Buffer.from(JSON.stringify(envelope)), {
    persistent: true,
  })
}

/** Handler de un EngineEvent ya desenvuelto; `ack`/`nack` delegan al mensaje AMQP. */
export type EngineEventHandler = (event: EngineEvent<EngineEventPayload>) => Promise<void>

/** Suscribe a `engine.events`; entrega cada EngineEvent desenvuelto y validado, con ack manual tras `handler` (at-least-once). Devuelve el cierre del canal. */
export async function consumeEngineEvents(handler: EngineEventHandler): Promise<() => Promise<void>> {
  const wrapper = getConnection().createChannel({
    setup: async (channel: ConfirmChannel) => {
      await channel.assertQueue(EVENTS_QUEUE, { durable: true })
      await channel.prefetch(1)
      await channel.consume(
        EVENTS_QUEUE,
        (msg: ConsumeMessage | null) => {
          if (!msg) return
          void handleMessage(wrapper, msg, handler)
        },
        { noAck: false }
      )
    },
  })

  return async () => {
    await wrapper.close().catch(() => undefined)
  }
}

// Un evento que siempre falla se reencolaría para siempre y bloquearía al resto: se cuenta por contenido y se descarta al 5.º intento.
const MAX_INTENTOS_EVENTO = 5
const intentosFallidos = new Map<string, number>()

async function handleMessage(
  wrapper: ChannelWrapper,
  msg: ConsumeMessage,
  handler: EngineEventHandler
): Promise<void> {
  let event: EngineEvent<EngineEventPayload>
  try {
    const raw: unknown = JSON.parse(msg.content.toString())
    // Tolerante: si algo publica el evento sin el sobre de Nest, se acepta igual
    const candidate =
      raw && typeof raw === 'object' && 'data' in raw && 'pattern' in raw
        ? (raw as NestEventEnvelope<unknown>).data
        : raw
    const parsed = EngineEventSchema.safeParse(candidate)
    if (!parsed.success) {
      console.error(
        '[rabbitmq] Evento de engine.events no cumple el contrato, se rechaza sin reencolar:',
        JSON.stringify(parsed.error.issues)
      )
      wrapper.nack(msg, false, false)
      return
    }
    event = parsed.data as EngineEvent<EngineEventPayload>
  } catch (err) {
    console.error('[rabbitmq] Mensaje de engine.events ilegible (JSON inválido), se rechaza sin reencolar:', err)
    wrapper.nack(msg, false, false)
    return
  }

  const clave = createHash('sha1').update(msg.content).digest('hex')
  try {
    await handler(event)
    intentosFallidos.delete(clave)
    wrapper.ack(msg)
  } catch (err) {
    const intentos = (intentosFallidos.get(clave) ?? 0) + 1
    if (intentos >= MAX_INTENTOS_EVENTO) {
      intentosFallidos.delete(clave)
      console.error(`[rabbitmq] Evento de engine.events falló ${intentos} veces, se descarta para no bloquear la cola (job ${event.jobId}, ${event.payload.type}):`, err)
      wrapper.nack(msg, false, false)
      return
    }
    intentosFallidos.set(clave, intentos)
    console.error(`[rabbitmq] Error procesando evento de engine.events (intento ${intentos}/${MAX_INTENTOS_EVENTO}), se reencola:`, err)
    wrapper.nack(msg, false, true)
  }
}
