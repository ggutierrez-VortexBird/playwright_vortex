// __tests__/components/ejecuciones/paso-accordion-item.test.tsx
// TDD RED/GREEN/TRIANGULATE for HU-4.5 PasoAccordionItem

import { render, screen, fireEvent } from "@testing-library/react";
import { PasoAccordionItem } from "@/components/ejecuciones/paso-accordion-item";

function makePaso(overrides: Partial<Parameters<typeof PasoAccordionItem>[0]["paso"]> = {}) {
  return {
    id: "paso-1",
    numero: 1,
    descripcion: "should load home page",
    estado: "paso",
    duracionMs: 1200,
    selfHealed: false,
    errorMsg: null,
    resultadoEsperado: "Page loads with HTTP 200",
    resultadoObtenido: "Page loaded OK",
    errorCount: 0,
    logs: null,
    createdAt: "2026-08-20T10:00:00Z",
    subacciones: [],
    ...overrides,
  };
}

describe("PasoAccordionItem", () => {
  it("renderiza header con número, descripción y estado", () => {
    render(
      <PasoAccordionItem
        paso={makePaso()}
        expanded={false}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("should load home page")).toBeInTheDocument();
    expect(screen.getByText("Conforme")).toBeInTheDocument();
  });

  it("llama onToggle al hacer click en el header", () => {
    const onToggle = jest.fn();
    render(<PasoAccordionItem paso={makePaso()} expanded={false} onToggle={onToggle} />);
    const header = screen.getByRole("button");
    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("tiene atributos de accesibilidad correctos", () => {
    render(<PasoAccordionItem paso={makePaso()} expanded={false} onToggle={jest.fn()} />);
    const header = screen.getByRole("button");
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(header).toHaveAttribute("aria-controls", expect.stringContaining("panel-"));
  });

  it("muestra el panel cuando expanded=true", () => {
    render(<PasoAccordionItem paso={makePaso()} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByText("Detalles Técnicos")).toBeInTheDocument();
  });

  it("oculta el panel cuando expanded=false", () => {
    render(<PasoAccordionItem paso={makePaso()} expanded={false} onToggle={jest.fn()} />);
    expect(screen.queryByText("Detalles Técnicos")).not.toBeInTheDocument();
  });

  it("renderiza resultadoEsperado y resultadoObtenido en panel 2-col", () => {
    render(<PasoAccordionItem paso={makePaso()} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByText("Page loads with HTTP 200")).toBeInTheDocument();
    expect(screen.getByText("Page loaded OK")).toBeInTheDocument();
  });

  it("no renderiza resultadoEsperado cuando es null", () => {
    render(
      <PasoAccordionItem
        paso={makePaso({ resultadoEsperado: null })}
        expanded={true}
        onToggle={jest.fn()}
      />
    );
    expect(screen.queryByText("Resultado esperado")).not.toBeInTheDocument();
  });

  it("renderiza logs cuando existen", () => {
    const paso = makePaso({
      logs: [{ ts: "10:00:00", level: "error", msg: "Timeout", source: "page" }],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByText(/Timeout/)).toBeInTheDocument();
  });

  it("muestra capturas cuando la subacción las tiene", () => {
    const paso = makePaso({
      subacciones: [
        {
          id: "sub-1",
          numero: 1,
          descripcion: "Sub click",
          estado: "fallo",
          duracionMs: 100,
          tipo: "action",
          errorMsg: null,
          logs: null,
          capturaActual: { id: "art-1", tipo: "captura", nombre: "actual.png", bytes: 1024 },
          capturaReferencia: null,
        },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByAltText(/Captura actual/i)).toBeInTheDocument();
  });

  it("muestra fallback 'Evidencia no disponible' cuando la imagen falla al cargar", () => {
    const paso = makePaso({
      subacciones: [
        {
          id: "sub-1",
          numero: 1,
          descripcion: "Sub click",
          estado: "fallo",
          duracionMs: 100,
          tipo: "action",
          errorMsg: null,
          logs: null,
          capturaActual: { id: "art-1", tipo: "captura", nombre: "actual.png", bytes: 1024 },
          capturaReferencia: { id: "art-2", tipo: "captura", nombre: "ref.png", bytes: 1024 },
        },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    const actualImg = screen.getByAltText(/Captura actual/i);
    fireEvent.error(actualImg);
    expect(screen.getByText("Evidencia no disponible")).toBeInTheDocument();

    const refImg = screen.getByAltText(/Referencia esperada/i);
    fireEvent.error(refImg);
    const fallbacks = screen.getAllByText("Evidencia no disponible");
    expect(fallbacks.length).toBe(2);
  });
});
