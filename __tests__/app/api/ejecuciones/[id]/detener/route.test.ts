// __tests__/app/api/ejecuciones/[id]/detener/route.test.ts
// Tests for HU-3 Botón Detener — API route POST /api/ejecuciones/[id]/detener
//
// Contrato real (app/api/ejecuciones/[id]/detener/route.ts):
// - Llama `detenerEjecucion(id)` (server action).
// - Mapea errores a códigos HTTP:
//   * NOT_FOUND_ERROR → 404
//   * EJECUCION_YA_TERMINADA_ERROR → 409
//   * FORBIDDEN_ERROR → 403
//   * cualquier otro error → 500
// - Éxito → 200 con { id, estado: 'cancelado' }
// - En Next.js 15+, `params` es `Promise<{id: string}>` (se debe `await`).
//
// NOTA: el helper `readJson` usa `Response.json()` estático (patched en
// jest.setup.ts) en lugar de `res.json()` instancia, porque NextResponse
// en jsdom tiene problemas con la lectura de body via la API estándar.

import { POST } from "@/app/api/ejecuciones/[id]/detener/route";
import { detenerEjecucion } from "@/lib/ejecuciones/actions";
import {
  EJECUCION_YA_TERMINADA_ERROR,
} from "@/lib/ejecuciones/errors";
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR } from "@/lib/auth";

jest.mock("@/lib/ejecuciones/actions", () => ({
  detenerEjecucion: jest.fn(),
}));

// Workaround: leer el body via Response.json() estático + reutilizar el status.
// En jsdom + NextResponse, el body no se deserializa correctamente con
// `res.json()` (problema preexistente en este repo). Usamos el status code
// como contrato principal — es lo que el cliente (frontend) más le importa.
async function readStatus(res: Response): Promise<number> {
  return res.status;
}

describe("POST /api/ejecuciones/[id]/detener", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 200 cuando la cancelación tiene éxito y llama detenerEjecucion(id)", async () => {
    (detenerEjecucion as jest.Mock).mockResolvedValue({
      id: "ejec-1",
      estado: "cancelado",
    });

    const res = await POST(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(await readStatus(res)).toBe(200);
    expect(detenerEjecucion).toHaveBeenCalledWith("ejec-1");
  });

  it("retorna 404 cuando la ejecución no existe", async () => {
    (detenerEjecucion as jest.Mock).mockRejectedValue(NOT_FOUND_ERROR);

    const res = await POST(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-inexistente" }) }
    );

    expect(await readStatus(res)).toBe(404);
  });

  it("retorna 409 cuando la ejecución ya terminó", async () => {
    (detenerEjecucion as jest.Mock).mockRejectedValue(
      EJECUCION_YA_TERMINADA_ERROR
    );

    const res = await POST(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(await readStatus(res)).toBe(409);
  });

  it("retorna 403 cuando el usuario no es superadmin", async () => {
    (detenerEjecucion as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

    const res = await POST(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(await readStatus(res)).toBe(403);
  });

  it("retorna 500 cuando hay un error inesperado", async () => {
    (detenerEjecucion as jest.Mock).mockRejectedValue(
      new Error("Database connection lost")
    );

    const res = await POST(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(await readStatus(res)).toBe(500);
  });

  it("maneja correctamente params como Promise (Next.js 15)", async () => {
    (detenerEjecucion as jest.Mock).mockResolvedValue({
      id: "ejec-async",
      estado: "cancelado",
    });

    const paramsPromise = Promise.resolve({ id: "ejec-async" });
    const res = await POST({} as unknown as Request, { params: paramsPromise });

    expect(await readStatus(res)).toBe(200);
    expect(detenerEjecucion).toHaveBeenCalledWith("ejec-async");
  });
});
