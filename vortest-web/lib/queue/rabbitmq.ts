// lib/queue/rabbitmq.ts
// Único módulo de vortest-web que sabe que RabbitMQ existe. Lo usan dos
// procesos distintos que comparten este código fuente (pero NO memoria en
// runtime): el proceso Next.js (dispararEjecucion publica a `engine.execute`)
// y scripts/execution-consumer.ts (consume `engine.events` y también
// publica a `engine.execute` para el job del hijo en el encadenamiento
// padre/hijo — ver lib/ejecuciones/actions.ts).
//
// GOTCHA no obvio (verificado leyendo node_modules/@nestjs/microservices):
// vortest-engine consume `engine.execute` con un @EventPattern('engine.execute')
// sobre un ClientProxy de NestJS (Transport.RMQ). Nest NO publica el payload
// "crudo" a la cola — lo envuelve como `{ pattern: <queue>, data: <payload> }`
// (ver ClientProxy.emit() -> dispatchEvent() -> RmqRecordSerializer). Su
// IncomingRequestDeserializer del lado consumidor solo enruta correctamente
// si encuentra ese sobre; si publicáramos el ExecuteJobMessage "pelado", Nest
// lo trata como mensaje "externo", no encuentra pattern, y lo descarta con un
// nack sin reintento ("no event handler found"). Por eso publishExecuteJob
// envuelve el mensaje exactamente así. Simétricamente, lo que vortest-engine
// publica a `engine.events` vía su propio ClientProxy también llega envuelto
// — por eso consumeEngineEvents desenvuelve `.data` antes de entregar el
// EngineEvent real al caller.
import amqp, { type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager'
import type { ConfirmChannel, ConsumeMessage } from 'amqplib'
import { env } from '../env'
import {
  EngineEventSchema,
  type ExecuteJobMessage,
  type EngineEvent,
  type EngineEventPayload,
} from './engine-contract'

export const EXECUTE_QUEUE = 'engine.execute'
export const EVENTS_QUEUE = 'engine.events'

/**
 * [FIA-10] Argumentos de la cola `engine.execute`: quorum + límite de
 * entregas + dead-letter exchange, para que un mensaje "veneno" termine en la
 * DLQ en vez de reencolarse para siempre. vortest-engine declara la cola con
 * EXACTAMENTE los mismos argumentos.
 *
 * ADVERTENCIA: RabbitMQ rechaza redeclarar una cola existente con argumentos
 * distintos (406 PRECONDITION_FAILED): hay que borrar la cola `engine.execute`
 * existente antes de desplegar este cambio. `engine.events` NO cambia.
 */
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

// [FIA-04] amqp-connection-manager: reconecta solo con backoff y vuelve a
// ejecutar el `setup` de cada canal (re-asegura colas y re-registra el
// consumidor) tras cada reconexión. Cacheado en globalThis (mismo patrón que
// lib/db.ts) para sobrevivir al hot-reload de `next dev`.
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

/**
 * Publica un job a `engine.execute`. Usado por `dispararEjecucion` (caso sin
 * padre pendiente, o el propio caso padre) y por `execution-consumer.ts`
 * (el job del hijo, una vez que el padre terminó 'paso').
 *
 * Si no hay conexión, el mensaje espera en memoria hasta `PUBLISH_TIMEOUT_MS`
 * y luego la promesa rechaza (el llamador marca la ejecución como errorMotor).
 */
export async function publishExecuteJob(message: ExecuteJobMessage): Promise<void> {
  const channel = getPublishChannel()
  const envelope = wrapNestEvent(EXECUTE_QUEUE, message)
  await channel.sendToQueue(EXECUTE_QUEUE, Buffer.from(JSON.stringify(envelope)), {
    persistent: true,
  })
}

/**
 * Handler de un EngineEvent ya desenvuelto (sin el sobre {pattern,data} de
 * Nest). `ack`/`nack` delegan al mensaje AMQP original.
 */
export type EngineEventHandler = (event: EngineEvent<EngineEventPayload>) => Promise<void>

/**
 * Se suscribe a `engine.events` y entrega cada EngineEvent ya desenvuelto y
 * VALIDADO (FIA-09) al handler. Ack manual: solo se ackea tras que `handler`
 * resuelva sin lanzar — un error deja el mensaje para reentrega (at-least-once,
 * mismo criterio que vortest-engine). Un mensaje que no valida contra el
 * contrato se rechaza sin reencolar (irá a la DLQ cuando exista).
 * Sobrevive a reconexiones: el `setup` se re-ejecuta y re-registra el consumidor.
 * Devuelve una función para cerrar el canal (graceful shutdown).
 */
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

async function handleMessage(
  wrapper: ChannelWrapper,
  msg: ConsumeMessage,
  handler: EngineEventHandler
): Promise<void> {
  let event: EngineEvent<EngineEventPayload>
  try {
    const raw: unknown = JSON.parse(msg.content.toString())
    // Tolerante: si algún día algo publica el evento "pelado" (sin el sobre
    // de Nest), lo aceptamos igual en vez de descartarlo.
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

  try {
    await handler(event)
    wrapper.ack(msg)
  } catch (err) {
    console.error('[rabbitmq] Error procesando evento de engine.events, se reencola:', err)
    wrapper.nack(msg, false, true)
  }
}
