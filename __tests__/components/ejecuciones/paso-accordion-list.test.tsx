// __tests__/components/ejecuciones/paso-accordion-list.test.tsx
// TDD RED/GREEN/TRIANGULATE for HU-4.5 PasoAccordionList + fix sub-pasos dentro panel

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

function makePasosConSubs(pasoId: string, subs: Array<{ id: string; numero: number; descripcion: string }>) {
  return [{
    id: pasoId,
    numero: 1,
    descripcion: "Step 1",
    estado: "paso",
    duracionMs: 100,
    selfHealed: false,
    errorMsg: null,
    resultadoEsperado: null,
    resultadoObtenido: null,
    errorCount: 0,
    logs: null,
    createdAt: "2026-08-20T10:00:00Z",
    subacciones: subs.map((s) => ({
      id: s.id,
      numero: s.numero,
      descripcion: s.descripcion,
      estado: "paso",
      duracionMs: 100,
      tipo: "action",
      errorMsg: null,
      logs: null,
    })),
  }];
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

  // ============================================================
  // FIX HU-4.5: sub-pasos dentro del panel
  // ============================================================

  it("does not render sub-pasos outside the panel anymore", () => {
    const pasos = makePasosConSubs("paso-1", [
      { id: "sub-1", numero: 1, descripcion: "sub-1" },
      { id: "sub-2", numero: 2, descripcion: "sub-2" },
    ]);
    render(<PasoAccordionList pasos={pasos as any} />);
    const panel = document.getElementById("panel-paso-1");
    expect(panel).not.toBeNull();
    const allSubs = screen.getAllByTestId("subaccion-item");
    // Todos los sub-pasos deben estar dentro del panel
    allSubs.forEach((sub) => {
      expect(panel!.contains(sub)).toBe(true);
    });
    // Y NO debe haber sub-pasos fuera (es decir, la cantidad dentro === cantidad total)
    expect(allSubs.length).toBe(2);
  });

  it("passes expandedSubaccionId to the expanded PasoAccordionItem", () => {
    const pasos = makePasosConSubs("paso-1", [
      { id: "sub-1", numero: 1, descripcion: "sub-1" },
      { id: "sub-2", numero: 2, descripcion: "sub-2" },
    ]);
    render(<PasoAccordionList pasos={pasos as any} />);
    // Paso 1 ya está expandido por default; clickeamos sub-2 para expandirlo
    const subs = screen.getAllByTestId("subaccion-item");
    const sub2Button = subs[1].querySelector("button")!;
    fireEvent.click(sub2Button);
    // El sub-2 debe tener aria-expanded=true (porque está dentro del subaccion-item expandido)
    expect(sub2Button).toHaveAttribute("aria-expanded", "true");
    // El sub-1 debe tener aria-expanded=false
    const sub1Button = subs[0].querySelector("button")!;
    expect(sub1Button).toHaveAttribute("aria-expanded", "false");
  });
});
