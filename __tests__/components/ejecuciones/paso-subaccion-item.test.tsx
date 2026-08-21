// __tests__/components/ejecuciones/paso-subaccion-item.test.tsx
// TDD RED/GREEN/TRIANGULATE for HU-4.5 PasoSubaccionItem

import { render, screen, fireEvent } from "@testing-library/react";
import { PasoSubaccionItem } from "@/components/ejecuciones/paso-subaccion-item";

function makeSubaccion(overrides: Partial<Parameters<typeof PasoSubaccionItem>[0]["subaccion"]> = {}) {
  return {
    id: "sub-1",
    numero: 1,
    descripcion: "Click button",
    estado: "paso",
    duracionMs: 200,
    tipo: "action",
    errorMsg: null,
    logs: null,
    capturaActual: null,
    capturaReferencia: null,
    ...overrides,
  };
}

describe("PasoSubaccionItem", () => {
  it("renderiza header con número, descripción y tipo", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion()} expanded={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Click button")).toBeInTheDocument();
    expect(screen.getByText("action")).toBeInTheDocument();
  });

  it("llama onToggle al hacer click", () => {
    const onToggle = jest.fn();
    render(<PasoSubaccionItem subaccion={makeSubaccion()} expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("muestra panel con capturas cuando expanded=true", () => {
    const sub = makeSubaccion({
      capturaActual: { id: "art-1", tipo: "captura", nombre: "actual.png", bytes: 1024 },
      capturaReferencia: { id: "art-2", tipo: "captura", nombre: "ref.png", bytes: 1024 },
    });
    render(<PasoSubaccionItem subaccion={sub} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByAltText(/Captura actual/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Referencia esperada/i)).toBeInTheDocument();
  });

  it("muestra errorMsg cuando existe", () => {
    const sub = makeSubaccion({ errorMsg: "Element not found" });
    render(<PasoSubaccionItem subaccion={sub} expanded={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Element not found")).toBeInTheDocument();
  });

  it("muestra logs en panel cuando expanded=true", () => {
    const sub = makeSubaccion({
      logs: [{ ts: "10:00:00", level: "error", msg: "click failed", source: "page" }],
    });
    render(<PasoSubaccionItem subaccion={sub} expanded={true} onToggle={jest.fn()} />);
    expect(screen.getByText(/click failed/)).toBeInTheDocument();
  });

  it("aplica animación write-in cuando es nuevo", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion()} expanded={false} onToggle={jest.fn()} isNew />);
    expect(screen.getByTestId("subaccion-item")).toHaveClass("new");
  });

  it("muestra fallback 'Evidencia no disponible' cuando la imagen falla al cargar", () => {
    const sub = makeSubaccion({
      capturaActual: { id: "art-1", tipo: "captura", nombre: "actual.png", bytes: 1024 },
      capturaReferencia: { id: "art-2", tipo: "captura", nombre: "ref.png", bytes: 1024 },
    });
    render(<PasoSubaccionItem subaccion={sub} expanded={true} onToggle={jest.fn()} />);
    const actualImg = screen.getByAltText(/Captura actual/i);
    fireEvent.error(actualImg);
    expect(screen.getByText("Evidencia no disponible")).toBeInTheDocument();

    const refImg = screen.getByAltText(/Referencia esperada/i);
    fireEvent.error(refImg);
    const fallbacks = screen.getAllByText("Evidencia no disponible");
    expect(fallbacks.length).toBe(2);
  });
});
