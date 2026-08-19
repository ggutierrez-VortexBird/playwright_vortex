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
    casoPruebaId: "caso-1",
    casoPrueba: { nombre: "Login test", codigo: "CP-01" },
    pasos: [
      { id: "paso-1", numero: 1, descripcion: "Navegar", estado: "paso", duracionMs: 1000, selfHealed: false, errorMsg: null, createdAt: "2026-08-12T10:00:00.000Z" },
      { id: "paso-2", numero: 2, descripcion: "Click", estado: "paso", duracionMs: 2000, selfHealed: false, errorMsg: null, createdAt: "2026-08-12T10:00:01.000Z" },
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

  it("renderiza capturas vinculadas a pasos", () => {
    const ejecucion = mockEjecucion({
      estado: "paso",
      artefactos: [
        { id: "art-2", tipo: "captura", nombre: "screenshot.png", pasoEjecucionId: "paso-1", bytes: 512, createdAt: "2026-08-12T10:01:00.000Z" },
      ],
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const img = screen.getByAltText("Captura paso 1");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/api/artefactos/art-2");
  });

  it("muestra capturas no mapeadas en galería genérica", () => {
    const ejecucion = mockEjecucion({
      estado: "paso",
      artefactos: [
        { id: "art-3", tipo: "captura", nombre: "unmapped.png", pasoEjecucionId: null, bytes: 256, createdAt: "2026-08-12T10:01:00.000Z" },
      ],
    });
    render(<EjecucionDetalleClient ejecucionId="ejec-1" initialEjecucion={ejecucion} />);

    const img = screen.getByAltText("Captura");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/api/artefactos/art-3");
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
});
