// __tests__/app/api/ejecuciones/[id]/route.test.ts
// Tests for HU-4.2 — GET /api/ejecuciones/[id] includes artefactos in response

import { GET } from "@/app/api/ejecuciones/[id]/route";
import { getEjecucionConPasos } from "@/lib/ejecuciones/queries";

jest.mock("@/lib/ejecuciones/queries", () => ({
  getEjecucionConPasos: jest.fn(),
}));

// Mock NextResponse.json to return a standard Response with readable body in jsdom
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: (body: unknown, init?: ResponseInit) => {
        return new Response(JSON.stringify(body), {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...((init?.headers as Record<string, string>) || {}),
          },
        });
      },
    },
  };
});

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("GET /api/ejecuciones/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 404 cuando la ejecución no existe", async () => {
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(null);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-inexistente" }) }
    );

    expect(res.status).toBe(404);
  });

  it("incluye artefactos en la respuesta JSON", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      estado: "paso",
      inicioAt: new Date("2026-08-12T10:00:00Z"),
      finAt: new Date("2026-08-12T10:02:00Z"),
      duracionMs: 120000,
      errorMsg: null,
      casoPrueba: {
        id: "caso-1",
        nombre: "Login test",
        codigo: "CP-LOGIN-01",
        proyecto: {
          id: "proy-1",
          nombre: "Login Proyecto",
          espacio: { id: "esp-1", nombre: "Espacio Login" },
        },
      },
      pasos: [
        { id: "paso-1", numero: 1, descripcion: "Navegar", estado: "paso", duracionMs: 1000, selfHealed: false, errorMsg: null, createdAt: new Date() },
      ],
      artefactos: [
        { id: "art-1", tipo: "video", nombre: "video.webm", path: "/storage/artefactos/ejec-1/video.webm", sha256: "abc123", bytes: 1024, createdAt: new Date("2026-08-12T10:01:00Z"), pasoEjecucionId: null },
        { id: "art-2", tipo: "captura", nombre: "screenshot.png", path: "/storage/artefactos/ejec-1/screenshot.png", sha256: "def456", bytes: 512, createdAt: new Date("2026-08-12T10:01:30Z"), pasoEjecucionId: "paso-1" },
      ],
    };
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(mockEjecucion);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await readJson(res) as any;
    expect(body.artefactos).toHaveLength(2);
    expect(body.artefactos[0].id).toBe("art-1");
    expect(body.artefactos[0].tipo).toBe("video");
    expect(body.artefactos[0].bytes).toBe(1024);
    expect(body.artefactos[1].pasoEjecucionId).toBe("paso-1");
  });

  it("incluye artefactos vacíos cuando no hay evidencia", async () => {
    const mockEjecucion = {
      id: "ejec-2",
      estado: "corriendo",
      inicioAt: new Date("2026-08-12T10:00:00Z"),
      finAt: null,
      duracionMs: null,
      errorMsg: null,
      casoPrueba: {
        id: "caso-1",
        nombre: "Login test",
        codigo: "CP-LOGIN-01",
        proyecto: {
          id: "proy-1",
          nombre: "Login Proyecto",
          espacio: { id: "esp-1", nombre: "Espacio Login" },
        },
      },
      pasos: [],
      artefactos: [],
    };
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(mockEjecucion);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-2" }) }
    );

    expect(res.status).toBe(200);
    const body = await readJson(res) as any;
    expect(body.artefactos).toEqual([]);
  });

  it("expone subacciones y nuevos campos de paso en la respuesta (HU-4.5)", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      estado: "fallo",
      inicioAt: new Date("2026-08-12T10:00:00Z"),
      finAt: new Date("2026-08-12T10:02:00Z"),
      duracionMs: 120000,
      errorMsg: null,
      entorno: "Producción",
      navegador: "Chrome 115",
      sistemaOperativo: "Linux (Ubuntu)",
      nodoEjecucion: "192.168.1.104",
      asercionesTotal: 124,
      asercionesOk: 118,
      asercionesFail: 6,
      casoPrueba: {
        id: "caso-1",
        nombre: "Login test",
        codigo: "CP-LOGIN-01",
        proyecto: {
          id: "proy-1",
          nombre: "Login Proyecto",
          espacio: { id: "esp-1", nombre: "Espacio Login" },
        },
      },
      pasos: [
        {
          id: "paso-1",
          numero: 1,
          descripcion: "Navegar",
          estado: "fallo",
          duracionMs: 1000,
          selfHealed: false,
          errorMsg: "Timeout",
          resultadoEsperado: "Debe cargar",
          resultadoObtenido: "Timeout 30000ms",
          errorCount: 1,
          logs: null,
          createdAt: new Date(),
          subacciones: [
            {
              id: "sub-1",
              numero: 1,
              descripcion: "Sub-paso navegar",
              estado: "fallo",
              duracionMs: 500,
              tipo: "action",
              errorMsg: null,
              logs: null,
              capturaActual: null,
              capturaReferencia: null,
            },
          ],
        },
      ],
      artefactos: [],
    };
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(mockEjecucion);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await readJson(res) as any;
    expect(body.entorno).toBe("Producción");
    expect(body.navegador).toBe("Chrome 115");
    expect(body.asercionesTotal).toBe(124);
    expect(body.asercionesOk).toBe(118);
    expect(body.asercionesFail).toBe(6);
    expect(body.pasos).toHaveLength(1);
    expect(body.pasos[0].resultadoEsperado).toBe("Debe cargar");
    expect(body.pasos[0].resultadoObtenido).toBe("Timeout 30000ms");
    expect(body.pasos[0].errorCount).toBe(1);
    expect(body.pasos[0].subacciones).toHaveLength(1);
    expect(body.pasos[0].subacciones[0].descripcion).toBe("Sub-paso navegar");
  });

  it("HU-G17: expone casoPrueba.origen en la respuesta JSON", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      estado: "paso",
      inicioAt: new Date("2026-08-12T10:00:00Z"),
      finAt: new Date("2026-08-12T10:02:00Z"),
      duracionMs: 120000,
      errorMsg: null,
      casoPrueba: {
        id: "caso-1",
        nombre: "Caso Grabado",
        codigo: "CP-G-01",
        origen: "grabador", // HU-G17
        proyecto: { id: "p", nombre: "P", espacio: { id: "e", nombre: "E" } },
      },
      pasos: [],
      artefactos: [],
    };
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(mockEjecucion);

    const res = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "ejec-1" }) }
    );

    const body = await readJson(res) as any;
    expect(body.casoPrueba.origen).toBe("grabador");
  });
});
