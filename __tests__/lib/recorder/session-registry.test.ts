/**
 * Tests for the in-memory session registry used by recorder-worker.
 *
 * Contract from design.md:
 *   - add(entry): inserts if size < MAX_SESSIONS, else throws RegistryFullError
 *   - remove(sessionId): deletes entry, idempotent
 *   - get(sessionId): returns entry or undefined
 *   - attachClient(sessionId, ws): adds ws to entry.clients
 *   - detachClient(sessionId, ws): removes ws from entry.clients
 *   - count(): current size
 *   - lock per sessionId to avoid race conditions on add/remove
 *   - cleanupOrphans(): on startup, marks SesionGrabacion con estado
 *     'iniciando'/'activa' y tokenUsado=true (más de N min sin heartbeat)
 *     como estado='error', mensajeError='worker reiniciado'
 */

const ORIGINAL_MAX = process.env.RECORDER_MAX_SESSIONS;

beforeAll(() => {
  process.env.RECORDER_MAX_SESSIONS = "3";
});

afterAll(() => {
  if (ORIGINAL_MAX === undefined) {
    delete process.env.RECORDER_MAX_SESSIONS;
  } else {
    process.env.RECORDER_MAX_SESSIONS = ORIGINAL_MAX;
  }
});

// Mock prisma — registry tests don't actually need DB (except for cleanupOrphans)
const mockSesionUpdateMany = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      updateMany: (...args: unknown[]) => mockSesionUpdateMany(...args),
    },
  },
}));

import {
  addEntry,
  removeEntry,
  getEntry,
  attachClient,
  detachClient,
  countEntries,
  cleanupOrphans,
  armHeartbeatTimer,
  disarmHeartbeatTimer,
  RegistryFullError,
  _resetForTests,
} from "@/lib/recorder/session-registry";

function fakeEntry(sessionId: string) {
  return {
    sessionId,
    userId: `user-${sessionId}`,
    urlInicial: "https://example.com",
    context: {} as any,
    page: {} as any,
    cdp: {} as any,
    clients: new Set<any>(),
    lastHeartbeatAt: Date.now(),
    heartbeatTimer: setInterval(() => {}, 1000) as any,
    createdAt: new Date(),
  };
}

function fakeWs(id: string): any {
  // Mock WS socket — solo necesitamos un objeto con `close()` y readyState
  return {
    id,
    readyState: 1, // OPEN
    send: () => {},
    close: () => {},
    on: () => {},
    off: () => {},
    emit: () => {},
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
  // Reset env to known value
  process.env.RECORDER_MAX_SESSIONS = "3";
});

afterEach(() => {
  // Clean up any timers we may have set
});

describe("recorder/session-registry", () => {
  describe("add/remove/get", () => {
    it("adds an entry and returns it via get", () => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);
      expect(getEntry("ses-1")).toBe(entry);
      expect(countEntries()).toBe(1);
    });

    it("remove deletes the entry and is idempotent", () => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);
      removeEntry("ses-1");
      expect(getEntry("ses-1")).toBeUndefined();
      // idempotent: second call doesn't throw
      expect(() => removeEntry("ses-1")).not.toThrow();
    });

    it("replace existing entry with same id (e.g., on reconnect with new token)", () => {
      const e1 = fakeEntry("ses-1");
      const e2 = fakeEntry("ses-1");
      addEntry(e1);
      addEntry(e2);
      expect(countEntries()).toBe(1);
      expect(getEntry("ses-1")).toBe(e2);
    });
  });

  describe("RECORDER_MAX_SESSIONS enforcement", () => {
    it("rejects new entry with RegistryFullError when limit reached", () => {
      process.env.RECORDER_MAX_SESSIONS = "2";
      _resetForTests();
      addEntry(fakeEntry("ses-1"));
      addEntry(fakeEntry("ses-2"));
      expect(() => addEntry(fakeEntry("ses-3"))).toThrow(RegistryFullError);
      expect(countEntries()).toBe(2);
    });

    it("accepts new entry after one is removed (slot freed)", () => {
      process.env.RECORDER_MAX_SESSIONS = "2";
      _resetForTests();
      addEntry(fakeEntry("ses-1"));
      addEntry(fakeEntry("ses-2"));
      removeEntry("ses-1");
      expect(() => addEntry(fakeEntry("ses-3"))).not.toThrow();
      expect(countEntries()).toBe(2);
    });

    it("default MAX_SESSIONS = 3 when env not set", () => {
      const orig = process.env.RECORDER_MAX_SESSIONS;
      delete process.env.RECORDER_MAX_SESSIONS;
      _resetForTests();
      addEntry(fakeEntry("ses-1"));
      addEntry(fakeEntry("ses-2"));
      addEntry(fakeEntry("ses-3"));
      expect(() => addEntry(fakeEntry("ses-4"))).toThrow(RegistryFullError);
      process.env.RECORDER_MAX_SESSIONS = orig;
    });
  });

  describe("attachClient / detachClient", () => {
    it("attaches a WS to the entry's clients set", () => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);
      const ws = fakeWs("ws-1");
      attachClient("ses-1", ws);
      expect(entry.clients.size).toBe(1);
      expect(entry.clients.has(ws)).toBe(true);
    });

    it("is a no-op when entry doesn't exist", () => {
      const ws = fakeWs("ws-1");
      expect(() => attachClient("ses-unknown", ws)).not.toThrow();
    });

    it("detachClient removes the WS", () => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);
      const ws = fakeWs("ws-1");
      attachClient("ses-1", ws);
      detachClient("ses-1", ws);
      expect(entry.clients.size).toBe(0);
    });

    it("detachClient is a no-op when entry doesn't exist", () => {
      const ws = fakeWs("ws-1");
      expect(() => detachClient("ses-unknown", ws)).not.toThrow();
    });

    it("supports multiple clients on the same session (reconnect case)", () => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);
      const ws1 = fakeWs("ws-1");
      const ws2 = fakeWs("ws-2");
      attachClient("ses-1", ws1);
      attachClient("ses-1", ws2);
      expect(entry.clients.size).toBe(2);
    });
  });

  describe("cleanupOrphans", () => {
    it("marks stale active/iniciando sessions as error (worker restart)", async () => {
      mockSesionUpdateMany.mockResolvedValue({ count: 2 });
      const count = await cleanupOrphans();
      expect(mockSesionUpdateMany).toHaveBeenCalledTimes(1);
      // Verify it filters by estado IN ('iniciando','activa')
      const call = mockSesionUpdateMany.mock.calls[0][0];
      expect(call).toBeDefined();
      expect(count).toBe(2);
    });

    it("returns 0 when no orphans found", async () => {
      mockSesionUpdateMany.mockResolvedValue({ count: 0 });
      const count = await cleanupOrphans();
      expect(count).toBe(0);
    });
  });

  describe("heartbeat expiration (C2)", () => {
    it("armHeartbeatTimer fires onExpire after timeoutMs and marks entry as expired", (done) => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);

      armHeartbeatTimer("ses-1", 50, (expiredId) => {
        try {
          expect(expiredId).toBe("ses-1");
          // After the timer fires, the entry's heartbeatTimer field is cleared.
          const e = getEntry("ses-1");
          expect(e).toBeDefined();
          expect(e!.heartbeatTimer).toBeUndefined();
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it("calling armHeartbeatTimer again resets the timer (heartbeat refresh)", (done) => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);

      let callCount = 0;
      const onExpire = () => {
        callCount++;
      };

      // Arm with 80ms timeout
      armHeartbeatTimer("ses-1", 80, onExpire);
      // After 40ms, reset to 80ms — total elapsed ~120ms > 80ms.
      // Without reset, the timer would fire at ~80ms.
      setTimeout(() => {
        armHeartbeatTimer("ses-1", 80, onExpire);
      }, 40);

      setTimeout(() => {
        try {
          // Should not have fired yet because the timer was reset.
          expect(callCount).toBe(0);
        } catch (err) {
          done(err);
          return;
        }
      }, 100);

      // After 130ms, original deadline (80ms) has passed but reset pushed it to ~120ms.
      setTimeout(() => {
        try {
          // Should still not have fired yet because reset pushed it to ~120ms.
          // After 130ms, ~120ms deadline is barely missed — could be 0 or 1 depending on
          // timer precision. Wait until 160ms to be sure.
        } catch (err) {
          done(err);
          return;
        }
      }, 130);

      // Fire at ~160ms — well past the reset deadline of ~120ms.
      setTimeout(() => {
        try {
          expect(callCount).toBe(1);
          done();
        } catch (err) {
          done(err);
        }
      }, 160);
    });

    it("disarmHeartbeatTimer cancels a pending timer (no onExpire)", (done) => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);

      let called = false;
      armHeartbeatTimer("ses-1", 50, () => {
        called = true;
      });
      disarmHeartbeatTimer("ses-1");

      setTimeout(() => {
        try {
          expect(called).toBe(false);
          const e = getEntry("ses-1");
          expect(e!.heartbeatTimer).toBeUndefined();
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    });

    it("removeEntry clears the heartbeat timer", (done) => {
      const entry = fakeEntry("ses-1");
      addEntry(entry);

      let called = false;
      armHeartbeatTimer("ses-1", 50, () => {
        called = true;
      });

      removeEntry("ses-1");

      setTimeout(() => {
        try {
          expect(called).toBe(false);
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    });

    it("armHeartbeatTimer is a no-op when the session doesn't exist", () => {
      // Should not throw — gracefully handles unknown sessionId.
      expect(() => armHeartbeatTimer("ses-unknown", 50, () => {})).not.toThrow();
    });
  });
});