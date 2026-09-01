/**
 * Tests for components/grabador/agregar-verificacion-modal.tsx (HU-G6).
 *
 * Covers:
 *   - Renders the modal with the element label and assertion types
 *   - Switching assertionKind reveals/hides valorEsperado
 *   - Preview updates with the human-readable descripcion
 *   - Submit calls onSubmit with the correct payload
 *   - Cancel calls onCancel
 *   - ESC closes the modal
 *   - Submit button disabled when input is invalid (count requires positive number)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { AgregarVerificacionModal } from "@/components/grabador/agregar-verificacion-modal";

describe("AgregarVerificacionModal (HU-G6)", () => {
  const noop = () => undefined;

  it("renders the modal with the element label and assertion default", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="Submit"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("agregar-verificacion-modal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Agregar verificación" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sobre «Submit»/)).toBeInTheDocument();
    // The submit button is also labeled "Agregar verificación".
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    // Default assertion = visible
    expect(screen.getByTestId("assertion-kind-select")).toHaveValue("visible");
  });

  it("does NOT show valorEsperado when assertion=visible", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId("valor-esperado-input")).not.toBeInTheDocument();
  });

  it("shows valorEsperado when switching to texto_igual", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_igual" },
    });
    expect(screen.getByTestId("valor-esperado-input")).toBeInTheDocument();
  });

  it("submit is disabled when valorEsperado is empty and assertion needs valor", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_igual" },
    });
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("preview updates as the user types", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="Greeting"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_contiene" },
    });
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "Hola" },
    });
    expect(screen.getByTestId("descripcion-preview").textContent).toContain(
      "contenga «Hola»",
    );
  });

  it("calls onSubmit with the right payload on submit (visible)", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarVerificacionModal
        elementLabel="Submit"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith({
      assertionKind: "visible",
      valorEsperado: "",
    });
  });

  it("calls onSubmit with assertionKind + valorEsperado for texto_igual", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarVerificacionModal
        elementLabel="Username"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_igual" },
    });
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith({
      assertionKind: "texto_igual",
      valorEsperado: "admin@example.com",
    });
  });

  it("count assertion uses 'vez' (singular) when valor=1", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="Items"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "count" },
    });
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "1" },
    });
    expect(screen.getByTestId("descripcion-preview").textContent).toContain("1 vez");
  });

  it("count assertion uses 'veces' (plural) when valor!=1", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="Items"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "count" },
    });
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "5" },
    });
    expect(screen.getByTestId("descripcion-preview").textContent).toContain("5 veces");
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = jest.fn();
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("ESC key calls onCancel", () => {
    const onCancel = jest.fn();
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows errorMsg when provided", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
        errorMsg="Algo falló"
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Algo falló");
  });

  it("submit is disabled when busy=true", () => {
    render(
      <AgregarVerificacionModal
        elementLabel="X"
        origen="grabado"
        sesionId="ses-1"
        onSubmit={noop}
        onCancel={noop}
        busy
      />,
    );
    expect(screen.getByTestId("submit-button")).toBeDisabled();
    expect(screen.getByTestId("cancel-button")).toBeDisabled();
    expect(screen.getByText("Guardando…")).toBeInTheDocument();
  });
});
