import { render, cleanup, screen, fireEvent } from "@testing-library/react";
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

  // <Switch> no expone `disabled` en su API pública, así que no se prueba el bloqueo.
});