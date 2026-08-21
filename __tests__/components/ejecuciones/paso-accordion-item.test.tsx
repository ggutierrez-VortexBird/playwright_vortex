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

  // ============================================================
  // FIX HU-4.5: sub-pasos dentro del panel
  // ============================================================

  it("renders sub-pasos section inside expanded panel", () => {
    const paso = makePaso({
      subacciones: [
        { id: "sub-1", numero: 1, descripcion: "sub-1", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    const panel = document.getElementById("panel-paso-1");
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent(/Sub-pasos \(1\)/);
  });

  it("does not render sub-pasos when collapsed", () => {
    const paso = makePaso({
      subacciones: [
        { id: "sub-1", numero: 1, descripcion: "sub-1", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={false} onToggle={jest.fn()} />);
    expect(screen.queryByText(/Sub-pasos/)).not.toBeInTheDocument();
  });

  it("does not render sub-pasos section when paso has no subacciones", () => {
    render(<PasoAccordionItem paso={makePaso({ subacciones: [] })} expanded={true} onToggle={jest.fn()} />);
    expect(screen.queryByText(/Sub-pasos/)).not.toBeInTheDocument();
  });

  it("calls onToggleSubaccion with sub-id when sub-paso header clicked", () => {
    const onToggleSubaccion = jest.fn();
    const paso = makePaso({
      subacciones: [
        { id: "sub-1", numero: 1, descripcion: "sub-1", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
      ],
    });
    render(
      <PasoAccordionItem
        paso={paso}
        expanded={true}
        onToggle={jest.fn()}
        expandedSubaccionId={null}
        onToggleSubaccion={onToggleSubaccion}
      />
    );
    const subHeader = screen.getByTestId("subaccion-item").querySelector("button")!;
    fireEvent.click(subHeader);
    expect(onToggleSubaccion).toHaveBeenCalledWith("sub-1");
  });

  it("renders correct number of sub-pasos", () => {
    const paso = makePaso({
      subacciones: [
        { id: "sub-1", numero: 1, descripcion: "sub-1", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
        { id: "sub-2", numero: 2, descripcion: "sub-2", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
        { id: "sub-3", numero: 3, descripcion: "sub-3", estado: "paso", duracionMs: 100, tipo: "action", errorMsg: null, logs: null },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getAllByTestId("subaccion-item")).toHaveLength(3);
  });

  it("does not render grouped captures section anymore", () => {
    const paso = makePaso({
      subacciones: [
        { id: "sub-1", numero: 1, descripcion: "sub-1", estado: "fallo", duracionMs: 100, tipo: "action", errorMsg: null, logs: null, capturaActual: { id: "art-1", tipo: "captura", nombre: "a.png", bytes: 1024 } },
      ],
    });
    render(<PasoAccordionItem paso={paso} expanded={true} onToggle={jest.fn()} />);
    expect(screen.queryByText(/Capturas de evidencia/)).not.toBeInTheDocument();
  });
});
