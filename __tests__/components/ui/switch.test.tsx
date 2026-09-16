/**
 * Tests for components/ui/switch.tsx — Radix-based on/off switch.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders with role=switch and reflects the checked prop via aria-checked", () => {
    render(<Switch checked={false} onCheckedChange={jest.fn()} aria-label="Modo oscuro" />);
    const sw = screen.getByRole("switch", { name: "Modo oscuro" });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("reports aria-checked=true when checked=true", () => {
    render(<Switch checked={true} onCheckedChange={jest.fn()} aria-label="Notificaciones" />);
    const sw = screen.getByRole("switch", { name: "Notificaciones" });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("calls onCheckedChange with the new value when clicked", () => {
    const onCheckedChange = jest.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Toggle" />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("calls onCheckedChange with false when clicked while checked", () => {
    const onCheckedChange = jest.fn();
    render(<Switch checked={true} onCheckedChange={onCheckedChange} aria-label="Toggle" />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  // Nota: el componente <Switch> NO expone `disabled` en su API pública (su
  // interface solo acepta { checked, onCheckedChange, id, aria-label }), por
  // lo que no se testea el comportamiento de bloqueo aquí — Radix lo
  // soportaría si se reenviara la prop, pero no es parte del contrato actual.
});