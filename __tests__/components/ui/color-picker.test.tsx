/**
 * Tests for components/ui/color-picker.tsx.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ColorPicker } from "@/components/ui/color-picker";

describe("ColorPicker", () => {
  it("renders the eight default preset colors as buttons", () => {
    render(<ColorPicker name="color" value="#C9822F" onChange={jest.fn()} />);
    const presetLabels = [
      "Seleccionar color #C9822F",
      "Seleccionar color #0E6B4F",
      "Seleccionar color #A8322A",
      "Seleccionar color #A9741A",
      "Seleccionar color #3F3A7A",
      "Seleccionar color #2F6FA8",
      "Seleccionar color #5C8A3A",
      "Seleccionar color #6B7C8D",
    ];
    presetLabels.forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("renders the custom-color picker button", () => {
    render(<ColorPicker name="color" value="#C9822F" onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: /color personalizado/i })).toBeInTheDocument();
  });

  it("highlights the current value with aria-pressed=true", () => {
    render(<ColorPicker name="color" value="#0E6B4F" onChange={jest.fn()} />);
    const selected = screen.getByRole("button", { name: "Seleccionar color #0E6B4F" });
    const notSelected = screen.getByRole("button", { name: "Seleccionar color #C9822F" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(notSelected).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked color", () => {
    const onChange = jest.fn();
    render(<ColorPicker name="color" value="#C9822F" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar color #2F6FA8" }));
    expect(onChange).toHaveBeenCalledWith("#2F6FA8");
  });

  it("uses a custom colors list when provided", () => {
    render(
      <ColorPicker
        name="color"
        value="#FF0000"
        onChange={jest.fn()}
        colors={["#FF0000", "#00FF00", "#0000FF"]}
      />,
    );
    expect(screen.getByRole("button", { name: "Seleccionar color #FF0000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seleccionar color #00FF00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seleccionar color #0000FF" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Seleccionar color #C9822F" }),
    ).not.toBeInTheDocument();
  });

  it("treats a value outside the palette as a custom color (uses value as background)", () => {
    render(
      <ColorPicker name="color" value="#abcdef" onChange={jest.fn()} />,
    );
    const custom = screen.getByRole("button", { name: /color personalizado/i });
    // El botón custom usa el color del value como backgroundColor
    expect((custom as HTMLElement).style.backgroundColor).toBe("rgb(171, 205, 239)");
    // Ningún preset debe estar marcado como seleccionado (value no está en la paleta)
    const preset = screen.getByRole("button", { name: "Seleccionar color #C9822F" });
    expect(preset).toHaveAttribute("aria-pressed", "false");
  });
});