/**
 * Tests for components/grabador/use-heartbeat.ts — periodic HTTP heartbeat
 * hook (HU-G2).
 *
 * Covers:
 *   - Fires POST /api/grabador/sesiones/[sessionId]/heartbeat on mount
 *   - Re-fires at the configured interval (default 15s)
 *   - Pauses when document.visibilityState === 'hidden'
 *   - Resumes when visibility returns to 'visible'
 *   - Retries on failure (max 3) before marking online=false
 *   - Cleans up interval on unmount
 *
 * Testing strategy: use fake timers (jest.useFakeTimers + jest.advanceTimersByTime)
 * and mock global.fetch to assert call counts and responses.
 */

import { renderHook, act } from "@testing-library/react";
import { useHeartbeat } from "@/components/grabador/use-heartbeat";

const mockFetch = jest.fn();

beforeAll(() => {
  // jsdom doesn't ship a fetch by default; jest.setup installs whatwg-fetch
  // but we want full control over the mock.
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  // Reset visibility to visible by default.
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useHeartbeat", () => {
  it("fires an initial POST on mount", async () => {
    renderHook(() => useHeartbeat("ses-1"));

    // Initial beat fires async on mount; flush microtasks + pending timers.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
  });

  it("re-fires at the default 15s interval", async () => {
    renderHook(() => useHeartbeat("ses-1"));

    // Initial beat.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance 14.9s — no new beat yet.
    await act(async () => {
      jest.advanceTimersByTime(14_900);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance the remaining 100ms — beat #2 fires.
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("honors a custom interval", async () => {
    renderHook(() => useHeartbeat("ses-1", { intervalMs: 5_000 }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns online=true and lastBeat=null initially, then updates after success", async () => {
    const { result } = renderHook(() => useHeartbeat("ses-1"));

    expect(result.current.online).toBe(true);
    expect(result.current.lastBeat).toBeNull();

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.online).toBe(true);
    expect(typeof result.current.lastBeat).toBe("number");
    expect(result.current.lastBeat!).toBeGreaterThan(0);
  });

  it("retries up to maxRetries on failure before marking offline", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() =>
      useHeartbeat("ses-1", { intervalMs: 5_000, maxRetries: 3 }),
    );

    // 1st attempt — fails, retries=1.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.online).toBe(true); // not yet exceeded threshold

    // 2nd attempt (5s later) — fails, retries=2.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(result.current.online).toBe(true);

    // 3rd attempt (5s later) — fails, retries=3 → mark offline.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(result.current.online).toBe(false);
  });

  it("resets retries after a successful beat", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const { result } = renderHook(() =>
      useHeartbeat("ses-1", { intervalMs: 5_000, maxRetries: 3 }),
    );

    // Beat 1 fails (retries=1).
    await act(async () => {
      await Promise.resolve();
    });
    // Beat 2 fails (retries=2).
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    // Beat 3 succeeds → retries reset to 0.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(result.current.online).toBe(true);

    // Beat 4 fails — retries is now 1 again, NOT 4.
    mockFetch.mockRejectedValueOnce(new Error("again"));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(result.current.online).toBe(true);
  });

  it("pauses when document is hidden and resumes on visible", async () => {
    const { result } = renderHook(() =>
      useHeartbeat("ses-1", { intervalMs: 5_000, pauseOnHidden: true }),
    );

    // Beat 1.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Hide the tab.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Advance 30s — no beats should fire while hidden.
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.online).toBe(true);

    // Show the tab again.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    // Resuming fires an immediate beat.
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // And subsequent beats continue at the normal interval.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("cleans up the interval on unmount", async () => {
    const { unmount } = renderHook(() =>
      useHeartbeat("ses-1", { intervalMs: 5_000 }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    const callsAtUnmount = mockFetch.mock.calls.length;

    unmount();

    // Advance well past several intervals — no more beats should fire.
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(callsAtUnmount);
  });

  it("does nothing when sessionId is empty (no heartbeat, no fetch)", async () => {
    renderHook(() => useHeartbeat(""));

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does NOT pause on hidden when pauseOnHidden=false", async () => {
    renderHook(() =>
      useHeartbeat("ses-1", { intervalMs: 5_000, pauseOnHidden: false }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Hide the tab.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    // With pauseOnHidden=false, beats keep firing.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
