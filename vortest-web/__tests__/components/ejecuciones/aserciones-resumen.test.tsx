// __tests__/components/ejecuciones/aserciones-resumen.test.tsx
// TDD RED/GREEN for HU-4.5 AsercionesResumen

import { render, screen } from "@testing-library/react";
import { AsercionesResumen } from "@/components/ejecuciones/aserciones-resumen";

describe("AsercionesResumen", () => {
  it("renderiza Total, OK y Fail correctamente", () => {
    render(<AsercionesResumen total={124} ok={118} fail={6} />);
    expect(screen.getByText("124")).toBeInTheDocument();
    expect(screen.getByText("118")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("muestra em-dash cuando total es 0", () => {
    render(<AsercionesResumen total={0} ok={0} fail={0} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("Total = OK + Fail se cumple visualmente", () => {
    render(<AsercionesResumen total={10} ok={7} fail={3} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
