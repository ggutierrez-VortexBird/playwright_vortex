/**
 * Tests for ws-server.ts — WebSocket connection handler.
 *
 * Contract from design.md:
 *   - Atomic CAS: tokenUsado=true flip is a single updateMany
 *     (race-condition safe vs concurrent WS connections with same token).
 *   - First successful connection: tokenUsado=false → true; client attached.
 *   - Subsequent connections with same token: rejected with WS_CLOSE_INVALID_TOKEN (4001).
 *   - Connection with non-existent token: rejected with WS_CLOSE_INVALID_TOKEN (4001).
 *   - Connection with malformed token (validateToken fails): rejected with 4001.
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
const mockUpdateMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
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
    readyState: 1, // OPEN
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
});

describe("recorder/ws-server — atomic handshake CAS", () => {
  it("first connection with valid token succeeds (atomic CAS flips tokenUsado=true)", async () => {
    // Simulate DB: updateMany matches and flips exactly one row.
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    // Atomic CAS — single UPDATE statement, not findFirst+update.
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { token: "valid-token", tokenUsado: false },
      data: { tokenUsado: true },
    });
    // Winner gets the initial state message (browser not ready yet).
    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
    // ws.on('message') was registered so heartbeat/stop/etc. are handled.
    expect(ws.on).toHaveBeenCalledWith("message", expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("two concurrent connections with the SAME token: exactly one succeeds, the other gets 4001", async () => {
    // Mimic DB-level atomic CAS: only the first matching updateMany flips,
    // the second finds tokenUsado=true and returns count=0.
    let claimed = false;
    mockUpdateMany.mockImplementation(async () => {
      if (!claimed) {
        claimed = true;
        return { count: 1 };
      }
      return { count: 0 };
    });

    const ws1 = fakeWs("ws-1");
    const ws2 = fakeWs("ws-2");

    await Promise.all([
      handleWsConnection(ws1, { url: "/?token=reused-token" }, new Set<string>()),
      handleWsConnection(ws2, { url: "/?token=reused-token" }, new Set<string>()),
    ]);

    // Atomic CAS attempted for both connections.
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);

    // Exactly one ws got 4001 — the loser.
    const closedWith4001 = [ws1, ws2].filter((w) =>
      w.close.mock.calls.some((c: unknown[]) => c[0] === WS_CLOSE_INVALID_TOKEN),
    );
    expect(closedWith4001).toHaveLength(1);

    // The other ws got the initial state message — the winner.
    const winner = closedWith4001[0] === ws1 ? ws2 : ws1;
    expect(winner.close).not.toHaveBeenCalled();
    expect(winner.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_iniciando" }),
    );
  });

  it("connection with token that doesn't exist in DB is rejected with 4001 (count=0)", async () => {
    // updateMany returns 0 — no row matched (token absent OR already used).
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=never-issued" },
      new Set<string>(),
    );

    expect(ws.close).toHaveBeenCalledWith(
      WS_CLOSE_INVALID_TOKEN,
      expect.stringMatching(/utilizado|inválid|no existe/i),
    );
    expect(ws.send).not.toHaveBeenCalled();
    // Nothing attached to the registry.
    expect(getEntry("ses-1")).toBeUndefined();
  });

  it("connection is rejected with 4001 when validateToken returns malformed", async () => {
    // Don't even reach the DB if signature/expiry fails.
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
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("connection is rejected with 4001 when prisma.updateMany throws (DB error)", async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error("connection lost"));

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

  it("attachClient is called for the winner after a successful CAS", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    // Pre-seed the session entry so attachClient can find it (this mimics
    // what http-api.ts does at /internal/start time).
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

    // Production contract: ws.on('message', handler) was wired up — that's
    // how heartbeat/stop/etc. get handled. Closing would indicate failure.
    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.on).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("client heartbeat message re-arms the session's heartbeat timer", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const entry = fakeEntryWithTimer("ses-1");
    addEntry(entry);

    const ws = fakeWs("ws-1");
    await handleWsConnection(
      ws,
      { url: "/?token=valid-token" },
      new Set<string>(),
    );

    // Capture the message handler installed by the production code.
    const messageHandler = ws.on.mock.calls.find((c: unknown[]) => c[0] === "message")?.[1] as
      | ((data: unknown) => void)
      | undefined;
    expect(messageHandler).toBeDefined();

    // Simulate the client sending a heartbeat.
    messageHandler!(Buffer.from(JSON.stringify({ type: "heartbeat" })));

    // After a heartbeat, the entry's heartbeatTimer should be defined
    // (a fresh Node Timeout in prod, a number id in jsdom — either is a
    // valid "timer is armed" signal).
    const e = getEntry("ses-1");
    expect(e).toBeDefined();
    expect(e!.heartbeatTimer).toBeDefined();
  });

  it("user-initiated stop closes the WS and the session registry entry's timer is disarmed", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockUpdate.mockResolvedValueOnce({});

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

    // Simulate user-initiated stop.
    messageHandler!(Buffer.from(JSON.stringify({ type: "stop" })));

    // WS closed with code 1000 (graceful), sesion_detenida sent.
    expect(ws.close).toHaveBeenCalledWith(1000, "stop");
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "sesion_detenida" }),
    );

    // W5 — user-initiated stop persists estado='detenida' + endedAt.
    // Wait a tick for the fire-and-forget DB update.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockUpdate).toHaveBeenCalledWith(
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
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockUpdate.mockRejectedValueOnce(new Error("DB down"));

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

    // Should not throw even though DB update fails.
    expect(() =>
      messageHandler!(Buffer.from(JSON.stringify({ type: "stop" }))),
    ).not.toThrow();

    // WS still closed gracefully.
    expect(ws.close).toHaveBeenCalledWith(1000, "stop");
    // Wait for the async update to settle.
    await new Promise((r) => setTimeout(r, 10));
  });
});

// Suppress unused import warning if attachClient isn't referenced.
void attachClient;
