/**
 * Tests for ws-server.ts — HU-G5 pick/hover element queries.
 *
 * Verifies the WS message handlers respond to `pick` / `hover` by calling
 * `page.evaluate(...)` on the entry's page and returning serialized
 * elements / bboxes.
 *
 * Strategy: mock the entry in the session-registry to expose a fake
 * `page.evaluate` that returns controlled payloads. Then drive the
 * message handler (the one installed by handleWsConnection) and check
 * the WS responses.
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

// Mock prisma — handshake usa findUnique (token reusable, post-W3 fix).
const mockFindFirst = jest.fn();
jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: jest.fn(),
    },
  },
}));

const mockValidateToken = jest.fn();
jest.mock("@/lib/recorder/auth", () => ({
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
}));

import type { WebSocket as WsServerSocket } from "ws";
import { handleWsConnection } from "@/lib/recorder/ws-server";
import {
  _resetForTests,
  addEntry,
  type SessionEntry,
} from "@/lib/recorder/session-registry";

function fakeWs(): WsServerSocket & {
  close: jest.Mock;
  send: jest.Mock;
  on: jest.Mock;
  emit: jest.Mock;
  readyState: number;
} {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const ws = {
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

interface FakePageOpts {
  /** What `page.evaluate` should return when called. */
  evalResult: unknown;
  /** If set, page.evaluate will reject with this. */
  evalError?: unknown;
}

function entryWithFakePage(opts: FakePageOpts = { evalResult: null }): SessionEntry {
  const fakePage = {
    evaluate: jest.fn(async () => {
      if (opts.evalError !== undefined) throw opts.evalError;
      return opts.evalResult;
    }),
  };
  return {
    sessionId: "ses-1",
    userId: "user-1",
    urlInicial: "https://example.com",
    context: {} as never,
    page: fakePage as never,
    cdp: {} as never,
    clients: new Set(),
    lastHeartbeatAt: Date.now(),
    heartbeatTimer: undefined,
    createdAt: new Date(),
  };
}

function getMessageHandler(ws: ReturnType<typeof fakeWs>): (data: unknown) => void {
  const handler = ws.on.mock.calls.find((c: unknown[]) => c[0] === "message")?.[1] as
    | ((data: unknown) => void)
    | undefined;
  if (!handler) throw new Error("message handler not registered");
  return handler;
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
  mockValidateToken.mockReturnValue({
    ok: true,
    sessionId: "ses-1",
    userId: "user-1",
  });
  // Default: sesión activa existe en DB (post-W3: handshake solo verifica existencia + estado).
  mockFindFirst.mockResolvedValue({ id: "ses-1", estado: "activa" });
});

describe("recorder/ws-server — pick / hover (HU-G5)", () => {
  it("hover returns bbox from page.evaluate result", async () => {
    const entry = entryWithFakePage({
      evalResult: {
        tag: "button",
        role: "button",
        aria: "Submit",
        name: "",
        testId: "btn-submit",
        text: "Send",
        id: "",
        bbox: { x: 100, y: 200, width: 80, height: 30 },
      },
    });
    addEntry(entry);

    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    handler!(Buffer.from(JSON.stringify({ type: "hover", x: 50, y: 60 })));

    // Allow microtask queue to flush.
    await new Promise((r) => setTimeout(r, 10));

    expect(entry.page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      { x: 50, y: 60 },
    );
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "highlight",
        bbox: { x: 100, y: 200, width: 80, height: 30 },
      }),
    );
  });

  it("pick returns a serialized element with candidates prioritized testid>id>aria-label>name>text>css", async () => {
    const entry = entryWithFakePage({
      evalResult: {
        tag: "button",
        role: "button",
        aria: "Submit",
        name: "send",
        testId: "btn-submit",
        text: "Send",
        id: "submit-id",
        bbox: { x: 10, y: 20, width: 200, height: 30 },
      },
    });
    addEntry(entry);

    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    handler!(Buffer.from(JSON.stringify({ type: "pick", x: 80, y: 30 })));

    await new Promise((r) => setTimeout(r, 10));

    // Find the pick_result message among all sends.
    const calls = (ws.send as jest.Mock).mock.calls.map((c) => c[0]);
    const pickResult = calls.find((s) => typeof s === "string" && s.includes('"pick_result"'));
    expect(pickResult).toBeDefined();
    const parsed = JSON.parse(pickResult as string);
    expect(parsed.type).toBe("pick_result");
    expect(parsed.element).toBeTruthy();
    expect(parsed.element.tag).toBe("button");
    expect(parsed.element.testId).toBe("btn-submit");
    expect(parsed.element.aria).toBe("Submit");
    expect(parsed.element.bbox).toEqual({ x: 10, y: 20, width: 200, height: 30 });
    const strategies = parsed.element.candidates.map(
      (c: { strategy: string }) => c.strategy,
    );
    expect(strategies).toEqual([
      "testid",
      "id",
      "aria-label",
      "name",
      "text",
      "css",
    ]);
  });

  it("pick returns pick_result with element=null when elementFromPoint found nothing", async () => {
    const entry = entryWithFakePage({ evalResult: null });
    addEntry(entry);

    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    handler!(Buffer.from(JSON.stringify({ type: "pick", x: 0, y: 0 })));
    await new Promise((r) => setTimeout(r, 10));

    const calls = (ws.send as jest.Mock).mock.calls.map((c) => c[0]);
    const pickResult = calls.find((s) => typeof s === "string" && s.includes('"pick_result"'));
    const parsed = JSON.parse(pickResult as string);
    expect(parsed.element).toBeNull();
  });

  it("pick returns element=null when the entry has no page yet (browser not ready)", async () => {
    // Entry without a page — mimics the pre-browserReady placeholder.
    addEntry({
      sessionId: "ses-1",
      userId: "user-1",
      urlInicial: "https://example.com",
      context: null as never,
      page: null as never,
      cdp: null as never,
      clients: new Set(),
      lastHeartbeatAt: Date.now(),
      heartbeatTimer: undefined,
      createdAt: new Date(),
    });

    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    handler!(Buffer.from(JSON.stringify({ type: "pick", x: 1, y: 1 })));
    await new Promise((r) => setTimeout(r, 10));

    const calls = (ws.send as jest.Mock).mock.calls.map((c) => c[0]);
    const pickResult = calls.find((s) => typeof s === "string" && s.includes('"pick_result"'));
    expect(pickResult).toBeDefined();
    const parsed = JSON.parse(pickResult as string);
    expect(parsed.element).toBeNull();
  });

  it("swallows page.evaluate errors and returns null (defensive)", async () => {
    const entry = entryWithFakePage({
      evalResult: null,
      evalError: new Error("Target closed"),
    });
    addEntry(entry);

    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    // Should not throw even though page.evaluate rejects.
    expect(() =>
      handler!(Buffer.from(JSON.stringify({ type: "hover", x: 0, y: 0 }))),
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));

    const calls = (ws.send as jest.Mock).mock.calls.map((c) => c[0]);
    const highlight = calls.find((s) => typeof s === "string" && s.includes('"highlight"'));
    expect(highlight).toBeDefined();
    expect(JSON.parse(highlight as string).bbox).toBeNull();
  });

  it("ignores unknown message types silently (no send)", async () => {
    const ws = fakeWs();
    await handleWsConnection(ws, { url: "/?token=valid" }, new Set());

    const handler = getMessageHandler(ws);
    const callsBefore = (ws.send as jest.Mock).mock.calls.length;
    handler!(Buffer.from(JSON.stringify({ type: "what_is_this" })));
    const callsAfter = (ws.send as jest.Mock).mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no new send
  });
});
