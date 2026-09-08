/**
 * Tests para `lib/grabador/recorder-client.ts`.
 *
 * El bug más común: `RECORDER_PUBLIC_URL` es `ws://...` y terminaba
 * usándose como HTTP base, lo que hace que `fetch()` falle con
 * "fetch failed" sin un mensaje accionable. Cubrimos:
 *  - defaultRecorderHttpUrl resuelve correctamente (env + fallback)
 *  - detecta esquemas ws/wss temprano sin hacer fetch
 *  - mapeo 200 / 5xx / network error a las exceptions correctas
 */
import { callInternalStart, RecorderUnavailableError } from "@/lib/grabador/recorder-client";

const REAL_FETCH = global.fetch;
let capturedUrl = "";
let fetchCalled = false;

function stubFetchWith(handler: (url: string) => Response | Promise<Response>) {
  capturedUrl = "";
  fetchCalled = false;
  global.fetch = ((url: string | URL | Request, _init?: RequestInit) => {
    fetchCalled = true;
    const u = typeof url === "string" ? url : url.toString();
    capturedUrl = u;
    return Promise.resolve(handler(u));
  }) as typeof fetch;
}

function stubFetchReject(message: string) {
  capturedUrl = "";
  fetchCalled = false;
  global.fetch = ((url: string | URL | Request, _init?: RequestInit) => {
    fetchCalled = true;
    capturedUrl = typeof url === "string" ? url : url.toString();
    return Promise.reject(new TypeError(message));
  }) as typeof fetch;
}

afterEach(() => {
  global.fetch = REAL_FETCH;
  delete process.env.RECORDER_INTERNAL_URL;
  delete process.env.RECORDER_PUBLIC_URL;
  delete process.env.RECORDER_WS_PORT;
});

describe("recorder-client — derivación de URL", () => {
  beforeEach(() => {
    process.env.RECORDER_INTERNAL_SECRET = "test-secret";
  });

  test("usa RECORDER_INTERNAL_URL si está definida", async () => {
    process.env.RECORDER_INTERNAL_URL = "http://rec-internal.example.com:4100";
    stubFetchWith(() => new Response("{}", { status: 200 }));
    await callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" });
    expect(capturedUrl).toBe("http://rec-internal.example.com:4100/internal/start");
  });

  test("deriva http://localhost:<RECORDER_WS_PORT> si no hay INTERNAL_URL", async () => {
    process.env.RECORDER_WS_PORT = "4101";
    stubFetchWith(() => new Response("{}", { status: 200 }));
    await callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" });
    expect(capturedUrl).toBe("http://localhost:4101/internal/start");
  });

  test("ignora RECORDER_PUBLIC_URL aunque sea ws://", async () => {
    process.env.RECORDER_PUBLIC_URL = "ws://recorder.example.com:3100";
    stubFetchWith(() => new Response("{}", { status: 200 }));
    await callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" });
    expect(capturedUrl.startsWith("ws://")).toBe(false);
    expect(capturedUrl).toBe("http://localhost:3100/internal/start");
  });

  test("default = http://localhost:3100 si no hay env vars", async () => {
    stubFetchWith(() => new Response("{}", { status: 200 }));
    await callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" });
    expect(capturedUrl).toBe("http://localhost:3100/internal/start");
  });

  test("rechaza ws/wss antes de hacer fetch con mensaje claro", async () => {
    process.env.RECORDER_INTERNAL_URL = "wss://recorder.example.com";
    let fetched = false;
    const captured: { called: boolean; url: string } = { called: false, url: "" };
    global.fetch = (async (url: string | URL) => {
      fetched = true;
      captured.url = typeof url === "string" ? url : url.toString();
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await expect(
      callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" }),
    ).rejects.toThrow(/RECORDER_INTERNAL_URL.*apunta a wss/);
    expect(fetched).toBe(false);
  });
});

describe("recorder-client — mapeo de respuestas", () => {
  beforeEach(() => {
    process.env.RECORDER_INTERNAL_SECRET = "test-secret";
    process.env.RECORDER_INTERNAL_URL = "http://rec.test:3100";
  });

  test("200 con token+wsUrl+specPath → resultado normal", async () => {
    stubFetchWith(
      () =>
        new Response(
          JSON.stringify({
            token: "tok",
            wsUrl: "ws://rec.test:3100/?token=tok",
            specPath: "/tmp/x.spec.ts",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const result = await callInternalStart({
      sessionId: "s",
      userId: "u",
      urlInicial: "https://x",
    });
    expect(result).toEqual({
      token: "tok",
      wsUrl: "ws://rec.test:3100/?token=tok",
      specPath: "/tmp/x.spec.ts",
    });
  });

  test("500 con body JSON → RecorderUnavailableError 'returned 500'", async () => {
    stubFetchWith(
      () =>
        new Response(
          JSON.stringify({ error: "spawn_failed", message: "spawn EINVAL" }),
          { status: 500, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" }),
    ).rejects.toThrow(/returned 500/);
  });

  test("network error ('fetch failed') → RecorderUnavailableError(msg)", async () => {
    stubFetchReject("fetch failed");
    const caught = await callInternalStart({
      sessionId: "s",
      userId: "u",
      urlInicial: "https://x",
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(caught).toBeInstanceOf(RecorderUnavailableError);
    expect((caught as Error).message).toBe("fetch failed");
    expect(fetchCalled).toBe(true);
  });

  test("lanza RecorderUnavailableError si RECORDER_INTERNAL_SECRET no está", async () => {
    delete process.env.RECORDER_INTERNAL_SECRET;
    await expect(
      callInternalStart({ sessionId: "s", userId: "u", urlInicial: "https://x" }),
    ).rejects.toBeInstanceOf(RecorderUnavailableError);
  });
});
