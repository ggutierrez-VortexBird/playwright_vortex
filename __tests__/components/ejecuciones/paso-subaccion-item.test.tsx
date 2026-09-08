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

function makeSubaccionConCapturas(overrides: Partial<Parameters<typeof PasoSubaccionItem>[0]["subaccion"]> = {}) {
  return {
    ...makeSubaccion({ capturaActual: { id: "art-1", tipo: "captura", nombre: "actual.png", bytes: 1024 } }),
    ...overrides,
  };
}

describe("PasoSubaccionItem", () => {
  it("renderiza header con número, descripción y tipo", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccionConCapturas()} expanded={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Click button")).toBeInTheDocument();
    expect(screen.getByText("action")).toBeInTheDocument();
  });

  it("llama onToggle al hacer click", () => {
    const onToggle = jest.fn();
    render(<PasoSubaccionItem subaccion={makeSubaccionConCapturas()} expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("no renderiza button cuando substep no tiene capturas", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion()} expanded={false} onToggle={jest.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renderiza Camera icon cuando tiene capturas", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccionConCapturas()} expanded={false} onToggle={jest.fn()} />);
    // Lucide icons render as svg; query by class prefix
    const cameraIcon = document.querySelector('svg[class*="lucide-camera"]');
    expect(cameraIcon).toBeInTheDocument();
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

  it("aplica animación write-in cuando es nuevo", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion()} expanded={false} onToggle={jest.fn()} isNew />);
    expect(screen.getByTestId("subaccion-item")).toHaveClass("new");
  });

  it("muestra fallback 'Evidencia no disponible' cuando la imagen falla al cargar", () => {
    const sub = makeSubaccionConCapturas({
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

  // ============================================================
  // FIX HU-4.5: pill de estado en el header
  // ============================================================

  it("renders status pill 'Conforme' when estado is paso", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion({ estado: "paso" })} expanded={false} onToggle={jest.fn()} />);
    const pill = screen.getByText("Conforme");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass("bg-m3-tertiary-container/15");
    expect(pill).toHaveClass("text-m3-on-tertiary-container");
    expect(pill).toHaveClass("border-m3-tertiary-container/40");
  });

  it("renders status pill 'No conforme' when estado is fallo", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion({ estado: "fallo" })} expanded={false} onToggle={jest.fn()} />);
    const pill = screen.getByText("No conforme");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass("bg-m3-error-container/15");
    expect(pill).toHaveClass("text-m3-error");
    expect(pill).toHaveClass("border-m3-error/30");
  });

  it("renders status pill 'Reparado' when estado is reparado", () => {
    render(<PasoSubaccionItem subaccion={makeSubaccion({ estado: "reparado" })} expanded={false} onToggle={jest.fn()} />);
    const pill = screen.getByText("Reparado");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass("bg-m3-secondary-container/40");
    expect(pill).toHaveClass("text-m3-on-secondary-container");
    expect(pill).toHaveClass("border-m3-secondary/30");
  });
});
