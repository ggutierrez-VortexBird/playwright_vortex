// POST /api/ejecuciones/[id]/detener: mapea NOT_FOUND a 404, YA_TERMINADA a 409, FORBIDDEN a 403 y el resto a 500.

import { POST } from "@/app/api/ejecuciones/[id]/detener/route";
import { detenerEjecucion } from "@/lib/ejecuciones/actions";
import {
  EJECUCION_YA_TERMINADA_ERROR,
} from "@/lib/ejecuciones/errors";
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR } from "@/lib/auth";

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    getSession: jest.fn().mockResolvedValue({ userId: "user-1" }),
    getUsuarioActual: jest.fn().mockResolvedValue({ id: "user-1", email: "qa@example.com", rol: "superadmin", nombre: null }),
  };
});

jest.mock("@/lib/ejecuciones/actions", () => ({
  detenerEjecucion: jest.fn(),
}));

// Se lee el body con Response.json() estático: en jsdom NextResponse no deserializa bien con res.json().
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
