// __tests__/components/ejecuciones/entorno-details.test.tsx
// TDD RED/GREEN for HU-4.5 EntornoDetails

import { render, screen } from "@testing-library/react";
import { EntornoDetails } from "@/components/ejecuciones/entorno-details";

describe("EntornoDetails", () => {
  it("renderiza todos los campos cuando existen", () => {
    render(
      <EntornoDetails
        entorno="Producción"
        navegador="Chrome 115"
        sistemaOperativo="Linux (Ubuntu)"
        nodoEjecucion="192.168.1.104"
      />
    );
    expect(screen.getByText("Producción")).toBeInTheDocument();
    expect(screen.getByText("Chrome 115")).toBeInTheDocument();
    expect(screen.getByText("Linux (Ubuntu)")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.104")).toBeInTheDocument();
  });

  it("muestra em-dash cuando un campo es null", () => {
    render(<EntornoDetails entorno={null} navegador={null} sistemaOperativo={null} nodoEjecucion={null} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});
