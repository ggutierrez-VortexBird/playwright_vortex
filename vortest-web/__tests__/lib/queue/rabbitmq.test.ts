// __tests__/lib/queue/rabbitmq.test.ts
// GOTCHA cubierto por estos tests (ver comentario en lib/queue/rabbitmq.ts):
// vortest-engine consume `engine.execute` vía un ClientProxy de NestJS
// (Transport.RMQ), que envuelve cada mensaje como `{ pattern, data }`
// (RmqRecordSerializer) — un publish "pelado" del ExecuteJobMessage sin ese
// sobre es tratado como mensaje externo por el IncomingRequestDeserializer
// de Nest y se descarta sin ejecutar el handler. Estos tests verifican que
// publishExecuteJob arma el sobre correcto, y que consumeEngineEvents
// desenvuelve `.data` correctamente (lo que vortest-engine publica a
// engine.events pasa por el mismo ClientProxy, así que llega con el mismo
// sobre) y que un evento que siempre falla no bloquea la cola.
//
// La conexión es `amqp-connection-manager`: se mockea el manager y se ejecuta
// a mano el `setup` de cada canal, como haría el manager al (re)conectar.

import amqp from "amqp-connection-manager";
import { publishExecuteJob, consumeEngineEvents } from "@/lib/queue/rabbitmq";
import type { ExecuteJobMessage, EngineEvent } from "@/lib/queue/engine-contract";

jest.mock("@/lib/env", () => ({ env: { RABBITMQ_URL: "amqp://guest:guest@localhost:5672" } }));
jest.mock("amqp-connection-manager", () => ({ __esModule: true, default: { connect: jest.fn() } }));

type OpcionesCanal = { setup: (channel: unknown) => Promise<void> };

function reiniciarSingletons() {
  delete (globalThis as any).__vortestRabbitConn;
  delete (globalThis as any).__vortestRabbitPublishChannel;
}

/** Conexión falsa: cada createChannel devuelve un wrapper observable y guarda sus opciones. */
function conexionFalsa() {
  const wrappers: Array<Record<string, jest.Mock> & { opciones: OpcionesCanal }> = [];
  const conn = {
    on: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    createChannel: jest.fn().mockImplementation((opciones: OpcionesCanal) => {
      const wrapper = {
        opciones,
        sendToQueue: jest.fn().mockResolvedValue(true),
        ack: jest.fn(),
        nack: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };
      wrappers.push(wrapper as never);
      return wrapper;
    }),
  };
  (amqp.connect as jest.Mock).mockReturnValue(conn);
  return { conn, wrappers };
}

describe("publishExecuteJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reiniciarSingletons();
  });

  it("envuelve el mensaje como { pattern, data } — formato que espera el ClientProxy RMQ de Nest", async () => {
    const { wrappers } = conexionFalsa();
    const message: ExecuteJobMessage = {
      jobId: "ejec-1",
      scriptText: "test script",
      scriptFileName: "test.spec.ts",
      navegador: "chromium",
      timeoutMs: 600000,
      publishedAt: new Date().toISOString(),
    };

    await publishExecuteJob(message);

    const canal = wrappers[0];
    expect(canal.sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, buffer, opts] = canal.sendToQueue.mock.calls[0];
    expect(queue).toBe("engine.execute");
    expect(opts).toEqual({ persistent: true });
    expect(JSON.parse((buffer as Buffer).toString())).toEqual({ pattern: "engine.execute", data: message });
  });

  it("al (re)conectar declara la cola engine.execute con sus argumentos de quorum y dead-letter", async () => {
    const { wrappers } = conexionFalsa();
    await publishExecuteJob({ jobId: "ejec-1" } as ExecuteJobMessage);

    const assertQueue = jest.fn().mockResolvedValue(undefined);
    await wrappers[0].opciones.setup({ assertQueue });

    expect(assertQueue).toHaveBeenCalledWith(
      "engine.execute",
      expect.objectContaining({
        durable: true,
        arguments: expect.objectContaining({ "x-queue-type": "quorum", "x-delivery-limit": 5, "x-dead-letter-exchange": "engine.dlx" }),
      }),
    );
  });
});

describe("consumeEngineEvents", () => {
  const evento: EngineEvent = {
    jobId: "ejec-1",
    seq: 1,
    emittedAt: new Date().toISOString(),
    payload: { type: "env", navegador: "chromium", sistemaOperativo: "Linux", nodoEjecucion: "host" },
  };
  // jobId distinto por test: el contador de reintentos de la cola es del módulo y se indexa por contenido.
  const mensaje = (jobId = "ejec-1") => ({ content: Buffer.from(JSON.stringify({ pattern: "engine.events", data: { ...evento, jobId } })) });

  beforeEach(() => {
    jest.clearAllMocks();
    reiniciarSingletons();
  });

  /** Registra el consumidor y devuelve el callback que RabbitMQ invocaría por cada mensaje. */
  async function suscribir(handler: jest.Mock) {
    const { wrappers } = conexionFalsa();
    await consumeEngineEvents(handler);
    let alMensaje: ((msg: unknown) => void) | undefined;
    const canal = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((_cola: string, cb: (msg: unknown) => void) => {
        alMensaje = cb;
      }),
    };
    await wrappers[0].opciones.setup(canal);
    return {
      wrapper: wrappers[0],
      entregar: async (msg: unknown) => {
        alMensaje?.(msg);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    };
  }

  it("desenvuelve el sobre {pattern,data} de Nest antes de entregar el EngineEvent al handler", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const { wrapper, entregar } = await suscribir(handler);
    const msg = mensaje();

    await entregar(msg);

    expect(handler).toHaveBeenCalledWith(evento);
    expect(wrapper.ack).toHaveBeenCalledWith(msg);
    expect(wrapper.nack).not.toHaveBeenCalled();
  });

  it("nackea con requeue cuando el handler lanza", async () => {
    const handler = jest.fn().mockRejectedValue(new Error("db down"));
    const { wrapper, entregar } = await suscribir(handler);
    const msg = mensaje("ejec-requeue");

    await entregar(msg);

    expect(wrapper.ack).not.toHaveBeenCalled();
    expect(wrapper.nack).toHaveBeenCalledWith(msg, false, true);
  });

  it("descarta el evento (sin requeue) al 5.º fallo para no bloquear la cola", async () => {
    const handler = jest.fn().mockRejectedValue(new Error("siempre falla"));
    const { wrapper, entregar } = await suscribir(handler);
    const msg = mensaje("ejec-veneno");

    for (let i = 0; i < 5; i++) await entregar(msg);

    const llamadas = wrapper.nack.mock.calls.map((c) => c[2]);
    expect(llamadas).toEqual([true, true, true, true, false]);
  });

  it("rechaza sin reencolar un mensaje que no cumple el contrato", async () => {
    const handler = jest.fn();
    const { wrapper, entregar } = await suscribir(handler);
    const invalido = { content: Buffer.from(JSON.stringify({ pattern: "engine.events", data: { jobId: "x" } })) };

    await entregar(invalido);

    expect(handler).not.toHaveBeenCalled();
    expect(wrapper.nack).toHaveBeenCalledWith(invalido, false, false);
  });
});
