import "@testing-library/jest-dom";
import "whatwg-fetch";

// Override Response.json if it doesn't work correctly
const originalResponse = globalThis.Response;
if (originalResponse) {
  // Response.json() static method - add if missing or broken
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

// Patch NextResponse.json para que su body sea legible en jsdom.
// En jsdom, `Response.json(body, init)` produce un Response cuyo `body` es
// un ReadableStream que no se drena correctamente; Next.js construye
// `NextResponse` con `new NextResponse(response.body, response)` y el body
// queda vacío. Reimplementamos NextResponse.json para que pase el body
// como string pre-serializado (mismo efecto, pero sin ReadableStream).
try {
  // Lazy import: Next.js puede no estar inicializado en este punto del setup.
  // Usamos require() para que el módulo se cargue recién cuando se ejecute.
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
      // Construimos un NextResponse pasando el string como body (no stream).
      return new NextResponse(JSON.stringify(body), {
        ...init,
        headers,
      });
    };
  }
} catch {
  // Si next/server no está disponible (p.ej. tests sin Next), no pasa nada.
}
