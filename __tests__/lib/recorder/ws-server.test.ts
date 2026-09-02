/**
 * Tests for ws-server.ts — WebSocket connection handler.
 *
 * Contract (post-fix W3):
 *   - Token is REUSABLE for the same sessionId during the session's lifetime
 *     (refresh del navegador, reconexión por red → todos válidos).
 *   - HMAC signature + expiration validation is the only cryptographic gate.
 *   - DB-level check: session must exist and not be in a terminal state
 *     (descartada / guardada). For those states, close 4001.
 *   - No tokenUsado flag flip — the old one-shot CAS was the root cause of W3.
 */

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  }
});

// Mock prisma — ws-server tests don't need a real DB.
const mockFindFirst = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: jest.fn(),
    },
  },
}));

// Mock auth so we can control validateToken outcomes per test.
const mockValidateToken = jest.fn();
jest.mock("@/lib/recorder/auth", () => ({
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
}));

import type { WebSocket as WsServerSocket } from "ws";
import { handleWsConnection } from "@/lib/recorder/ws-server";
import {
  _resetForTests,
  addEntry,
  attachClient,
  countEntries,
  getEntry,
} from "@/lib/recorder/session-registry";
import type { SessionEntry } from "@/lib/recorder/types";
import { WS_CLOSE_INVALID_TOKEN } from "@/lib/recorder/types";

function fakeEntryWithTimer(sessionId: string): SessionEntry {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    urlInicial: "https://example.com",
    context: {} as never,
    page: {} as never,
    cdp: {} as never,
    clients: new Set(),
    lastHeartbeatAt: Date.now(),
    heartbeatTimer: undefined,
    createdAt: new Date(),
  };
}

function fakeWs(id: string): WsServerSocket & {
  close: jest.Mock;
  send: jest.Mock;
  on: jest.Mock;
  emit: jest.Mock;
  readyState: number;
} {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const ws: WsServerSocket & {
    close: jest.Mock;
    send: jest.Mock;
    on: jest.Mock;
    emit: jest.Mock;
    readyState: number;
  } = {
    id,
    readyState: 1,
    close: jest.fn(),
    send: jest.fn(),
    on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
      (handlers[event] ||= []).push(fn);
    }),
    off: jest.fn(),
    emit: jest.fn((event: string, ...args: unknown[]) => {
      (handlers[event] || []).forEach((fn) => fn(...args));
    }),
  } as unknown as WsServerSocket & {
    close: jest.Mock;
    send: jest.Mock;
    on: jest.Mock;
    emit: jest.Mock;
    readyState: number;
  };
  return ws;
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
  // Default: validateToken returns ok for tests that want it.
  mockValidateToken.mockReturnValue({
    ok: true,
    sessionId: "ses-1",
    userId: "user-1",
  });
  // Default: DB has an active session for the token.
  mockFindFirst.mockResolvedValue({ id: "ses-1", estado: "activa" });
});

describe("recorder/ws-server — handshake con token reusable", () => {
  it("connection with valid token + active session succeeds", async () => {
    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    // findUnique is the only DB call in the handshake path.
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { token: "valid-token" },
      select: { id: true, estado: true },
    });
    // Winner gets the initial state message (browser not ready yet).
    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
    expect(ws.on).toHaveBeenCalledWith("message", expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("two connections with the SAME token both succeed (token reusable, refresh-friendly)", async () => {
    // This is the W3 regression test: refresh del navegador debe poder
    // reconectar con el mismo token sin ser rechazado.
    const ws1 = fakeWs("ws-1");
    const ws2 = fakeWs("ws-2");

    await handleWsConnection(
      ws1,
      { url: "/?token=reused-token" },
      new Set<string>(),
    );
    await handleWsConnection(
      ws2,
      { url: "/?token=reused-token" },
      new Set<string>(),
    );

    // Ambas conexiones llegaron al DB check (no hay early reject).
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    // Ninguna fue rechazada.
    expect(ws1.close).not.toHaveBeenCalled();
    expect(ws2.close).not.toHaveBeenCalled();
    // Ambas recibieron sesion_iniciando.
    expect(ws1.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
    expect(ws2.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
  });

  it("connection is rejected with 4001 when token doesn't exist in DB", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=never-issued" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/no existe/i),
    );
    expect(ws.send).not.toHaveBeenCalled();
    expect(getEntry("ses-1")).toBeUndefined();
  });

  it("connection is rejected with 4001 when session is descartada (terminal)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ses-1", estado: "descartada" });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/terminal|descartada/i),
    );
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("connection is rejected with 4001 when session is guardada (terminal)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ses-1", estado: "guardada" });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/terminal|guardada/i),
    );
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("connection with session in 'iniciando' state is allowed (still alive)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ses-1", estado: "iniciando" });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
  });

  it("connection with session in 'pausada' state is allowed (user can resume)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ses-1", estado: "pausada" });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    expect(ws.close).not.toHaveBeenCalled();
  });

  it("connection is rejected with 4001 when validateToken returns malformed", async () => {
    mockValidateToken.mockReturnValueOnce({
      ok: false,
      reason: "malformed",
    });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=bogus" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/malformed|inválid/i),
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("connection is rejected with 4001 when prisma.findUnique throws (DB error)", async () => {
    mockFindFirst.mockRejectedValueOnce(new Error("connection lost"));

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=any" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/interno|error/i),
    );
  });

  it("attachClient is called for the connection after a successful handshake", async () => {
    attachClient(
      "ses-1",
      fakeWs("placeholder") as unknown as Parameters<typeof attachClient>[1],
    );

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.on).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("client heartbeat message re-arms the session's heartbeat timer", async () => {
    const entry = fakeEntryWithTimer("ses-1");
    addEntry(entry);

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    const messageHandler = ws.on.mock.calls.find((c: unknown[]) => c[0] === "message")?.[1] as
      | ((data: unknown) => void)
      | undefined;
    expect(messageHandler).toBeDefined();

    messageHandler!(Buffer.from(JSON.stringify({ type: "heartbeat" })));

    const e = getEntry("ses-1");
    expect(e).toBeDefined();
    expect(e!.heartbeatTimer).toBeDefined();
  });

  it("user-initiated stop closes the WS gracefully with sesion_detenida", async () => {
    const { prisma } = jest.requireMock("@/lib/db") as {
      prisma: { sesionGrabacion: { update: jest.Mock } };
    };
    prisma.sesionGrabacion.update.mockResolvedValueOnce({});

    const entry = fakeEntryWithTimer("ses-1");
    addEntry(entry);

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    const messageHandler = ws.on.mock.calls.find((c: unknown[]) => c[0] === "message")?.[1] as
      | ((data: unknown) => void)
      | undefined;
    expect(messageHandler).toBeDefined();

    messageHandler!(Buffer.from(JSON.stringify({ type: "stop" })));

    expect(ws.close).toHaveBeenCalledWith(1000, "stop");
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_detenida" }),
    );

    await new Promise((r) => setTimeout(r, 10));
    expect(prisma.sesionGrabacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ses-1" },
        data: expect.objectContaining({
          estado: "detenida",
          endedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("DB update failure on stop does NOT prevent WS from closing (fire-and-forget)", async () => {
    const { prisma } = jest.requireMock("@/lib/db") as {
      prisma: { sesionGrabacion: { update: jest.Mock } };
    };
    prisma.sesionGrabacion.update.mockRejectedValueOnce(new Error("DB down"));

    const entry = fakeEntryWithTimer("ses-1");
    addEntry(entry);

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    const messageHandler = ws.on.mock.calls.find((c: unknown[]) => c[0] === "message")?.[1] as
      | ((data: unknown) => void)
      | undefined;

    expect(() =>
      messageHandler!(Buffer.from(JSON.stringify({ type: "stop" }))),
    ).not.toThrow();

    expect(ws.close).toHaveBeenCalledWith(1000, "stop");
    await new Promise((r) => setTimeout(r, 10));
  });
});

// Suppress unused import warnings if any.
void countEntries;
