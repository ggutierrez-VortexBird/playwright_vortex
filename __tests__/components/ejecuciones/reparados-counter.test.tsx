/**
 * Tests for components/ejecuciones/reparados-counter.tsx (HU-G15 UI).
 *
 * Verifies:
 *   - Renders nothing when 0 reparados.
 *   - Renders "Reparados: N" when N >= 1.
 *   - Plural / singular agreement (always "Reparados:" — label is fixed).
 *   - data-count attribute reflects N.
 *   - Counts only steps where selfHealed=true.
 */

import { render, screen } from "@testing-library/react";
import { ReparadosCounter } from "@/components/ejecuciones/reparados-counter";

describe("ReparadosCounter — HU-G15", () => {
  it("does not render when no steps are selfHealed", () => {
    const { container } = render(
      <ReparadosCounter
        pasos={[{ selfHealed: false }, { selfHealed: false }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Reparados: 1' when exactly one step was reparado", () => {
    render(
      <ReparadosCounter
        pasos={[{ selfHealed: true }, { selfHealed: false }]}
      />,
    );
    const el = screen.getByTestId("reparados-counter");
    expect(el.textContent).toContain("Reparados: 1");
    expect(el.getAttribute("data-count")).toBe("1");
  });

  it("renders 'Reparados: N' for N >= 2", () => {
    render(
      <ReparadosCounter
        pasos={[
          { selfHealed: true },
          { selfHealed: true },
          { selfHealed: true },
          { selfHealed: false },
        ]}
      />,
    );
    const el = screen.getByTestId("reparados-counter");
    expect(el.textContent).toContain("Reparados: 3");
    expect(el.getAttribute("data-count")).toBe("3");
  });

  it("uses selfHealed=true as the only count predicate", () => {
    render(
      <ReparadosCounter
        pasos={[
          { selfHealed: true },
          // Forzamos un valor truthy pero != true → no cuenta
          { selfHealed: "yes" as unknown as boolean },
          { selfHealed: 1 as unknown as boolean },
        ]}
      />,
    );
    const el = screen.getByTestId("reparados-counter");
    expect(el.textContent).toContain("Reparados: 1");
  });

  it("handles empty pasos array (renders nothing)", () => {
    const { container } = render(<ReparadosCounter pasos={[]} />);
    expect(container.firstChild).toBeNull();
  });
});