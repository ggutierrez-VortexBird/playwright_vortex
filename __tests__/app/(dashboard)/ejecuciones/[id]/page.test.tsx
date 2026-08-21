// __tests__/app/(dashboard)/ejecuciones/[id]/page.test.tsx
// TDD RED/GREEN for HU-4.5 page.tsx mapping

import { render, screen } from "@testing-library/react";
import EjecucionDetallePage from "@/app/(dashboard)/ejecuciones/[id]/page";
import { getEjecucionConPasos } from "@/lib/ejecuciones/queries";

jest.mock("@/lib/ejecuciones/queries", () => ({
  getEjecucionConPasos: jest.fn(),
}));

jest.mock("@/components/ejecuciones/ejecucion-detalle-client", () => ({
  EjecucionDetalleClient: ({ initialEjecucion }: { initialEjecucion: any }) => (
    <div data-testid="ejecucion-detalle-client">
      <span data-testid="entorno">{initialEjecucion.entorno ?? "null"}</span>
      <span data-testid="navegador">{initialEjecucion.navegador ?? "null"}</span>
      <span data-testid="sistemaOperativo">{initialEjecucion.sistemaOperativo ?? "null"}</span>
      <span data-testid="nodoEjecucion">{initialEjecucion.nodoEjecucion ?? "null"}</span>
      <span data-testid="asercionesTotal">{initialEjecucion.asercionesTotal}</span>
      <span data-testid="asercionesOk">{initialEjecucion.asercionesOk}</span>
      <span data-testid="asercionesFail">{initialEjecucion.asercionesFail}</span>
      <span data-testid="pasosCount">{initialEjecucion.pasos.length}</span>
      <span data-testid="primerPasoResultadoEsperado">
        {initialEjecucion.pasos[0]?.resultadoEsperado ?? "null"}
      </span>
      <span data-testid="primerPasoResultadoObtenido">
        {initialEjecucion.pasos[0]?.resultadoObtenido ?? "null"}
      </span>
      <span data-testid="primerPasoErrorCount">
        {initialEjecucion.pasos[0]?.errorCount ?? "null"}
      </span>
      <span data-testid="primerPasoSubaccionesCount">
        {initialEjecucion.pasos[0]?.subacciones?.length ?? "null"}
      </span>
    </div>
  ),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("notFound");
  }),
}));

function makeEjecucion() {
  return {
    id: "ejec-1",
    casoPruebaId: "cp-1",
    estado: "paso" as const,
    inicioAt: new Date("2026-08-20T10:00:00Z"),
    finAt: new Date("2026-08-20T10:01:00Z"),
    duracionMs: 60000,
    errorMsg: null,
    entorno: "Producción",
    navegador: "Chrome 115",
    sistemaOperativo: "Linux (Ubuntu)",
    nodoEjecucion: "192.168.1.104",
    asercionesTotal: 10,
    asercionesOk: 8,
    asercionesFail: 2,
    createdAt: new Date("2026-08-20T10:00:00Z"),
    updatedAt: new Date("2026-08-20T10:01:00Z"),
    casoPrueba: {
      id: "cp-1",
      codigo: "CP-01",
      nombre: "Caso A",
    },
    pasos: [
      {
        id: "paso-1",
        ejecucionId: "ejec-1",
        numero: 1,
        descripcion: "Step 1",
        estado: "paso" as const,
        duracionMs: 1000,
        selfHealed: false,
        errorMsg: null,
        resultadoEsperado: "HTTP 200",
        resultadoObtenido: "HTTP 200",
        errorCount: 0,
        logs: [{ ts: "10:00:01", level: "info", msg: "ok", source: "page" }],
        createdAt: new Date("2026-08-20T10:00:00Z"),
        subacciones: [
          {
            id: "sub-1",
            ejecucionId: "ejec-1",
            pasoEjecucionId: "paso-1",
            numero: 1,
            tipo: "action",
            descripcion: "Click",
            estado: "paso" as const,
            duracionMs: 200,
            errorMsg: null,
            logs: null,
            capturaActualId: null,
            capturaReferenciaId: null,
            capturaActual: null,
            capturaReferencia: null,
            createdAt: new Date("2026-08-20T10:00:00Z"),
          },
        ],
        artefactos: [],
      },
    ],
    artefactos: [
      {
        id: "art-1",
        ejecucionId: "ejec-1",
        pasoEjecucionId: null,
        tipo: "video" as const,
        nombre: "video.webm",
        path: "/storage/artefactos/ejec-1/video.webm",
        sha256: "abc",
        bytes: 1024,
        metadata: null,
        createdAt: new Date("2026-08-20T10:00:00Z"),
      },
    ],
    subacciones: [],
    acta: null,
  };
}

describe("EjecucionDetallePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mapea todos los campos nuevos de Ejecucion y PasoEjecucion", async () => {
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(makeEjecucion());

    const jsx = await EjecucionDetallePage({ params: Promise.resolve({ id: "ejec-1" }) });
    render(jsx);

    expect(screen.getByTestId("entorno")).toHaveTextContent("Producción");
    expect(screen.getByTestId("navegador")).toHaveTextContent("Chrome 115");
    expect(screen.getByTestId("sistemaOperativo")).toHaveTextContent("Linux (Ubuntu)");
    expect(screen.getByTestId("nodoEjecucion")).toHaveTextContent("192.168.1.104");
    expect(screen.getByTestId("asercionesTotal")).toHaveTextContent("10");
    expect(screen.getByTestId("asercionesOk")).toHaveTextContent("8");
    expect(screen.getByTestId("asercionesFail")).toHaveTextContent("2");
    expect(screen.getByTestId("pasosCount")).toHaveTextContent("1");
    expect(screen.getByTestId("primerPasoResultadoEsperado")).toHaveTextContent("HTTP 200");
    expect(screen.getByTestId("primerPasoResultadoObtenido")).toHaveTextContent("HTTP 200");
    expect(screen.getByTestId("primerPasoErrorCount")).toHaveTextContent("0");
    expect(screen.getByTestId("primerPasoSubaccionesCount")).toHaveTextContent("1");
  });

  it("devuelve notFound cuando la ejecución no existe", async () => {
    (getEjecucionConPasos as jest.Mock).mockResolvedValue(null);
    await expect(EjecucionDetallePage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("notFound");
  });
});
