/**
 * Tests for components/ejecuciones/origen-chip.tsx (HU-G17).
 */

import { render, screen } from "@testing-library/react";
import { OrigenChip } from "@/components/ejecuciones/origen-chip";

describe("OrigenChip (HU-G17)", () => {
  it("muestra 'Origen: Grabador' cuando origen='grabador'", () => {
    render(<OrigenChip origen="grabador" />);
    const chip = screen.getByTestId("origen-chip");
    expect(chip).toBeInTheDocument();
    expect(chip.getAttribute("data-origen")).toBe("grabador");
    expect(chip).toHaveTextContent("Origen: Grabador");
  });

  it("muestra 'Origen: Subir Script' cuando origen='subirScript'", () => {
    render(<OrigenChip origen="subirScript" />);
    const chip = screen.getByTestId("origen-chip");
    expect(chip).toHaveTextContent("Origen: Subir Script");
  });

  it("muestra 'Origen: Mixto' cuando origen='mixto'", () => {
    render(<OrigenChip origen="mixto" />);
    const chip = screen.getByTestId("origen-chip");
    expect(chip).toHaveTextContent("Origen: Mixto");
  });

  it("usa un fallback genérico para origen desconocido", () => {
    render(<OrigenChip origen="desconocido" />);
    const chip = screen.getByTestId("origen-chip");
    expect(chip.getAttribute("data-origen")).toBe("desconocido");
    expect(chip).toHaveTextContent("Origen: desconocido");
  });
});
