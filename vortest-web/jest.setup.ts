import "@testing-library/jest-dom";
import "whatwg-fetch";

// Polyfill de Response.json si falta
const originalResponse = globalThis.Response;
if (originalResponse) {
  if (typeof (originalResponse as any).json !== "function") {
    (originalResponse as any).json = function(body: unknown, init?: ResponseInit): Response {
      return new originalResponse(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...((init?.headers as Record<string, string>) || {}),
        },
      });
    };
  }
}

// Reimplementa NextResponse.json con body string: en jsdom el stream del body queda vacío
try {
  // require() lazy: Next puede no estar inicializado en este punto
  const nextServer = require("next/server");
  const NextResponse = nextServer.NextResponse;
  if (NextResponse && typeof NextResponse.json === "function") {
    NextResponse.json = function patchedNextResponseJson(
      body: unknown,
      init?: ResponseInit,
    ): typeof NextResponse {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return new NextResponse(JSON.stringify(body), {
        ...init,
        headers,
      });
    };
  }
} catch {
  // Sin next/server (tests sin Next) no pasa nada
}
