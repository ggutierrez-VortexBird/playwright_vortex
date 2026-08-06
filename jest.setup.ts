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
