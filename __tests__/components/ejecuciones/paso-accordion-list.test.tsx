// __tests__/components/ejecuciones/paso-accordion-list.test.tsx
// TDD RED/GREEN/TRIANGULATE for HU-4.5 PasoAccordionList

import { render, screen, fireEvent } from "@testing-library/react";
import { PasoAccordionList } from "@/components/ejecuciones/paso-accordion-list";

function makePasos(count: number, estados?: string[]) {
  return Array.from({ length: count }, (_, i) => ({
    id: `paso-${i + 1}`,
    numero: i + 1,
    descripcion: `Step ${i + 1}`,
    estado: estados?.[i] ?? "paso",
    duracionMs: 100,
    selfHealed: false,
    errorMsg: null,
    resultadoEsperado: null,
    resultadoObtenido: null,
    errorCount: 0,
    logs: null,
    createdAt: "2026-08-20T10:00:00Z",
    subacciones: [],
  }));
}

describe("PasoAccordionList", () => {
  it("selecciona el primer paso por defecto", () => {
    render(<PasoAccordionList pasos={makePasos(3)} />);
    const firstPanel = screen.getByRole("button", { expanded: true });
    expect(firstPanel).toBeInTheDocument();
    expect(firstPanel).toHaveTextContent("Step 1");
  });

  it("permite solo un paso expandido a la vez", () => {
    render(<PasoAccordionList pasos={makePasos(3)} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("expande paso especificado por defaultExpandedId", () => {
    render(<PasoAccordionList pasos={makePasos(3)} defaultExpandedId="paso-2" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("notifica cambio de paso expandido vía onExpandedChange", () => {
    const onExpandedChange = jest.fn();
    render(<PasoAccordionList pasos={makePasos(2)} onExpandedChange={onExpandedChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onExpandedChange).toHaveBeenCalledWith("paso-2");
  });

  it("selecciona el primer paso con estado 'fallo' por defecto", () => {
    render(<PasoAccordionList pasos={makePasos(3, ["paso", "fallo", "paso"])} />);
    const expandedButton = screen.getByRole("button", { expanded: true });
    expect(expandedButton).toHaveTextContent("Step 2");
  });

  it("si no hay pasos fallidos, selecciona el primer paso por defecto", () => {
    render(<PasoAccordionList pasos={makePasos(2, ["paso", "paso"])} />);
    const expandedButton = screen.getByRole("button", { expanded: true });
    expect(expandedButton).toHaveTextContent("Step 1");
  });

  it("si no hay pasos, ninguno está expandido", () => {
    render(<PasoAccordionList pasos={[]} />);
    expect(screen.queryByRole("button", { expanded: true })).not.toBeInTheDocument();
  });

  it("defaultExpandedId anula la lógica de selección por defecto", () => {
    render(<PasoAccordionList pasos={makePasos(3, ["paso", "fallo", "paso"])} defaultExpandedId="paso-1" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
  });
});
