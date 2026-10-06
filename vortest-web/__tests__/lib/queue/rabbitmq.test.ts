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
// sobre).

import amqp from "amqplib";
import { publishExecuteJob, consumeEngineEvents } from "@/lib/queue/rabbitmq";
import type { ExecuteJobMessage, EngineEvent } from "@/lib/queue/engine-contract";

jest.mock("amqplib");

describe("publishExecuteJob", () => {
  const sendToQueue = jest.fn().mockReturnValue(true);
  const assertQueue = jest.fn().mockResolvedValue(undefined);
  const createChannel = jest.fn();
  const connect = amqp.connect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RABBITMQ_URL = "amqp://guest:guest@localhost:5672";
    // Reset del singleton cacheado en globalThis entre tests.
    delete (globalThis as any).__vortestRabbitConn;
    delete (globalThis as any).__vortestRabbitPublishChannel;

    createChannel.mockResolvedValue({
      assertQueue,
      sendToQueue,
      on: jest.fn(),
    });
    connect.mockResolvedValue({ createChannel });
  });

  it("envuelve el mensaje como { pattern, data } — formato que espera el ClientProxy RMQ de Nest", async () => {
    const message: ExecuteJobMessage = {
      jobId: "ejec-1",
      scriptText: "test script",
      scriptFileName: "test.spec.ts",
      timeoutMs: 600000,
      publishedAt: new Date().toISOString(),
    };

    await publishExecuteJob(message);

    expect(assertQueue).toHaveBeenCalledWith("engine.execute", { durable: true });
    expect(sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, buffer, opts] = sendToQueue.mock.calls[0];
    expect(queue).toBe("engine.execute");
    expect(opts).toEqual({ persistent: true });

    const parsed = JSON.parse((buffer as Buffer).toString());
    expect(parsed).toEqual({ pattern: "engine.execute", data: message });
  });
});

describe("consumeEngineEvents", () => {
  const connect = amqp.connect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RABBITMQ_URL = "amqp://guest:guest@localhost:5672";
    delete (globalThis as any).__vortestRabbitConn;
    delete (globalThis as any).__vortestRabbitPublishChannel;
  });

  it("desenvuelve el sobre {pattern,data} de Nest antes de entregar el EngineEvent al handler", async () => {
    let capturedConsumer: ((msg: any) => void) | undefined;
    const ack = jest.fn();
    const nack = jest.fn();
    const channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((_queue: string, cb: (msg: any) => void) => {
        capturedConsumer = cb;
      }),
      ack,
      nack,
    };
    connect.mockResolvedValue({ createChannel: jest.fn().mockResolvedValue(channel) });

    const handler = jest.fn().mockResolvedValue(undefined);
    await consumeEngineEvents(handler);

    const engineEvent: EngineEvent = {
      jobId: "ejec-1",
      seq: 1,
      emittedAt: new Date().toISOString(),
      payload: { type: "env", navegador: "chromium", sistemaOperativo: "Linux", nodoEjecucion: "host" },
    };
    const wireMessage = { pattern: "engine.events", data: engineEvent };
    const fakeMsg = { content: Buffer.from(JSON.stringify(wireMessage)) };

    capturedConsumer?.(fakeMsg);
    // Deja correr el microtask del IIFE async dentro del consumer callback.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).toHaveBeenCalledWith(engineEvent);
    expect(ack).toHaveBeenCalledWith(fakeMsg);
    expect(nack).not.toHaveBeenCalled();
  });

  it("nackea con requeue cuando el handler lanza", async () => {
    let capturedConsumer: ((msg: any) => void) | undefined;
    const ack = jest.fn();
    const nack = jest.fn();
    const channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((_queue: string, cb: (msg: any) => void) => {
        capturedConsumer = cb;
      }),
      ack,
      nack,
    };
    connect.mockResolvedValue({ createChannel: jest.fn().mockResolvedValue(channel) });

    const handler = jest.fn().mockRejectedValue(new Error("db down"));
    await consumeEngineEvents(handler);

    const wireMessage = {
      pattern: "engine.events",
      data: { jobId: "ejec-1", seq: 1, emittedAt: "now", payload: { type: "env" } },
    };
    const fakeMsg = { content: Buffer.from(JSON.stringify(wireMessage)) };

    capturedConsumer?.(fakeMsg);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(fakeMsg, false, true);
  });
});
