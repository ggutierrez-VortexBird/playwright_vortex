// __tests__/components/ejecuciones/ejecucion-detalle-client.test.tsx
// Tests for HU-4.2 — Execution detail client component with real video/screenshots

import { render, screen } from "@testing-library/react";
import { EjecucionDetalleClient } from "@/components/ejecuciones/ejecucion-detalle-client";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

function mockEjecucion(overrides: Record<string, unknown> = {}) {
  return {
    id: "ejec-1",
    estado: "paso",
    inicioAt: "2026-08-12T10:00:00.000Z",
    finAt: "2026-08-12T10:02:00.000Z",
    duracionMs: 120000,
    errorMsg: null,
    entorno: "Producción",
    navegador: "Chrome 115",
    sistemaOperativo: "Linux (Ubuntu)",
    nodoEjecucion: "192.168.1.104",
    asercionesTotal: 124,
    asercionesOk: 118,
    asercionesFail: 6,
    casoPruebaId: "caso-1",
    casoPrueba: { nombre: "Login test", codigo: "CP-01" },
    pasos: [
      { id: "paso-1", numero: 1, descripcion: "Navegar", estado: "paso", duracionMs: 1000, selfHealed: false, errorMsg: null, resultadoEsperado: null, resultadoObtenido: null, errorCount: 0, logs: null, createdAt: "2026-08-12T10:00:00.000Z", videoInicioMs: null, videoFinMs: null, subacciones: [] },
      { id: "paso-2", numero: 2, descripcion: "Click", estado: "paso", duracionMs: 2000, selfHealed: false, errorMsg: null, resultadoEsperado: null, resultadoObtenido: null, errorCount: 0, logs: null, createdAt: "2026-08-12T10:00:01.000Z", videoInicioMs: null, videoFinMs: null, subacciones: [] },
    ],
    artefactos: [] as any[],
    ...overrides,
  };
}

describe("EjecucionDetalleClient", () => {
  it("muestra 'Generando evidencia' cuando está corriendo y no hay artefactos", () => {
    const ejecucion = mockEjecucion({ estado: "corriendo", artefactos: [] });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    expect(screen.getByText("Generando evidencia")).toBeInTheDocument();
  });

  it("renderiza video real cuando hay un artefacto de tipo video", () => {
    const ejecucion = mockEjecucion({
      estado: "paso",
      artefactos: [
        { id: "art-1", tipo: "video", nombre: "video.webm", pasoEjecucionId: null, bytes: 1024, createdAt: "2026-08-12T10:01:00.000Z" },
      ],
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const video = screen.getByTestId("video-player");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/api/artefactos/art-1");
  });

  it("renderiza accordion de pasos en lugar de lista plana", () => {
    const ejecucion = mockEjecucion();
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);
    expect(screen.getByText("Navegar")).toBeInTheDocument();
    expect(screen.getByText("Click")).toBeInTheDocument();
    expect(screen.getByText("Pasos ejecutados")).toBeInTheDocument();
  });

  it("renderiza detalles de entorno y aserciones en columna derecha", () => {
    const ejecucion = mockEjecucion();
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);
    expect(screen.getByText("Producción")).toBeInTheDocument();
    expect(screen.getByText("Chrome 115")).toBeInTheDocument();
    expect(screen.getByText("124")).toBeInTheDocument();
    expect(screen.getByText("118")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renderiza barra de capítulos con ancho proporcional a duración", () => {
    const ejecucion = mockEjecucion({
      estado: "paso",
      pasos: [
        { id: "paso-1", numero: 1, descripcion: "A", estado: "paso", duracionMs: 1000, selfHealed: false, errorMsg: null, createdAt: "2026-08-12T10:00:00.000Z" },
        { id: "paso-2", numero: 2, descripcion: "B", estado: "paso", duracionMs: 2000, selfHealed: false, errorMsg: null, createdAt: "2026-08-12T10:00:01.000Z" },
        { id: "paso-3", numero: 3, descripcion: "C", estado: "paso", duracionMs: 1000, selfHealed: false, errorMsg: null, createdAt: "2026-08-12T10:00:02.000Z" },
      ],
      artefactos: [
        { id: "art-1", tipo: "video", nombre: "video.webm", pasoEjecucionId: null, bytes: 1024, createdAt: "2026-08-12T10:01:00.000Z" },
      ],
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const chapters = screen.getAllByTestId("chapter-bar");
    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toHaveStyle({ width: "25%" });
    expect(chapters[1]).toHaveStyle({ width: "50%" });
    expect(chapters[2]).toHaveStyle({ width: "25%" });
  });

  it("HU-G17: muestra chip 'Origen: Grabador' cuando casoPrueba.origen='grabador'", () => {
    const ejecucion = mockEjecucion({
      casoPrueba: { nombre: "Caso Grabado", codigo: "CP-G-01", origen: "grabador" },
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const chip = screen.getByTestId("origen-chip");
    expect(chip).toBeInTheDocument();
    expect(chip.getAttribute("data-origen")).toBe("grabador");
    expect(chip).toHaveTextContent("Origen: Grabador");
  });

  it("HU-G17: muestra chip 'Origen: Subir Script' cuando casoPrueba.origen='subirScript'", () => {
    const ejecucion = mockEjecucion({
      casoPrueba: { nombre: "Caso Subido", codigo: "CP-S-01", origen: "subirScript" },
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const chip = screen.getByTestId("origen-chip");
    expect(chip).toHaveTextContent("Origen: Subir Script");
  });

  it("HU-G17: NO muestra chip si casoPrueba.origen no está set (backwards compat)", () => {
    // Cuando el origen no viene (casos viejos antes de HU-G17), el chip
    // no debe renderizar para no romper el layout.
    const ejecucion = mockEjecucion({
      casoPrueba: { nombre: "Caso Legacy", codigo: "CP-L-01" },
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    expect(screen.queryByTestId("origen-chip")).not.toBeInTheDocument();
  });

  describe("HU-G18 — video chapter bar", () => {
    function mockEjecWithChapters(): ReturnType<typeof mockEjecucion> {
      return mockEjecucion({
        estado: "paso",
        pasos: [
          {
            id: "paso-1",
            numero: 1,
            descripcion: "Login",
            estado: "paso",
            duracionMs: 2000,
            selfHealed: false,
            errorMsg: null,
            resultadoEsperado: null,
            resultadoObtenido: null,
            errorCount: 0,
            logs: null,
            createdAt: "2026-08-12T10:00:00.000Z",
            videoInicioMs: 0,
            videoFinMs: 2000,
            subacciones: [],
          },
          {
            id: "paso-2",
            numero: 2,
            descripcion: "Submit",
            estado: "paso",
            duracionMs: 3000,
            selfHealed: false,
            errorMsg: null,
            resultadoEsperado: null,
            resultadoObtenido: null,
            errorCount: 0,
            logs: null,
            createdAt: "2026-08-12T10:00:02.000Z",
            videoInicioMs: 2000,
            videoFinMs: 5000,
            subacciones: [],
          },
        ],
        artefactos: [
          { id: "art-1", tipo: "video", nombre: "video.webm", pasoEjecucionId: null, bytes: 1024, createdAt: "2026-08-12T10:01:00.000Z" },
        ],
      });
    }

    it("renderiza los botones clickables del chapter bar cuando hay video", () => {
      const ejecucion = mockEjecWithChapters();
      render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

      const bar = screen.getByTestId("video-chapter-bar");
      expect(bar).toBeInTheDocument();

      const segments = screen.getAllByTestId("chapter-bar");
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments[0]).toHaveAttribute("data-paso-id", "paso-1");
      expect(segments[1]).toHaveAttribute("data-paso-id", "paso-2");
    });

    it("cada capítulo tiene un aria-label accesible", () => {
      const ejecucion = mockEjecWithChapters();
      render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

      const segments = screen.getAllByTestId("chapter-bar");
      expect(segments[0]).toHaveAttribute("aria-label", "Paso 1: Login");
      expect(segments[1]).toHaveAttribute("aria-label", "Paso 2: Submit");
    });

    it("marca como 'done' los capítulos con estado fallo", () => {
      const ejecucion = mockEjecucion({
        estado: "paso",
        pasos: [
          {
            id: "paso-1",
            numero: 1,
            descripcion: "Login",
            estado: "fallo",
            duracionMs: 1000,
            selfHealed: false,
            errorMsg: "timeout",
            resultadoEsperado: null,
            resultadoObtenido: null,
            errorCount: 1,
            logs: null,
            createdAt: "2026-08-12T10:00:00.000Z",
            videoInicioMs: 0,
            videoFinMs: 1000,
            subacciones: [],
          },
        ],
        artefactos: [
          { id: "art-1", tipo: "video", nombre: "video.webm", pasoEjecucionId: null, bytes: 1024, createdAt: "2026-08-12T10:01:00.000Z" },
        ],
      });
      render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

      const segments = screen.getAllByTestId("chapter-bar");
      expect(segments[0]).toHaveClass("done");
    });
  });
});
