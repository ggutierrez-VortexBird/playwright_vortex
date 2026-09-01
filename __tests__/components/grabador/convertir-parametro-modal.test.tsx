/**
 * Tests for components/grabador/convertir-parametro-modal.tsx (HU-G7).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import {
  ConvertirParametroModal,
  type ConvertirParametroInput,
} from "@/components/grabador/convertir-parametro-modal";

describe("ConvertirParametroModal (HU-G7)", () => {
  const noop = () => undefined;

  it("renders the modal with suggested name from label", () => {
    render(
      <ConvertirParametroModal
        elementLabel="Username"
        valorActual="admin@example.com"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("convertir-parametro-modal")).toBeInTheDocument();
    expect(screen.getByTestId("parametro-nombre-input")).toHaveValue("username");
    expect(screen.getByTestId("parametro-valor-input")).toHaveValue(
      "admin@example.com",
    );
  });

  it("derives a snake_case name when label has spaces", () => {
    render(
      <ConvertirParametroModal
        elementLabel="Saldo Esperado"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("parametro-nombre-input")).toHaveValue(
      "saldo_esperado",
    );
  });

  it("strips accents when deriving the suggested name", () => {
    render(
      <ConvertirParametroModal
        elementLabel="Contraseña"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("parametro-nombre-input")).toHaveValue(
      "contrasena",
    );
  });

  it("uses explicit suggestedName when provided", () => {
    render(
      <ConvertirParametroModal
        elementLabel="Foo"
        suggestedName="mi_parametro"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("parametro-nombre-input")).toHaveValue(
      "mi_parametro",
    );
  });

  it("falls back to 'parametro' when label has no alphanumeric chars", () => {
    render(
      <ConvertirParametroModal
        elementLabel="!!"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("parametro-nombre-input")).toHaveValue(
      "parametro",
    );
  });

  it("submit disabled when nombre is invalid (empty after trim)", () => {
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("parametro-nombre-input"), {
      target: { value: "" },
    });
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("submit disabled when nombre starts with digit", () => {
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("parametro-nombre-input"), {
      target: { value: "1bad" },
    });
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("calls onSubmit with name + valorDefecto on submit", () => {
    const onSubmit = jest.fn();
    render(
      <ConvertirParametroModal
        elementLabel="Username"
        valorActual="admin@example.com"
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith({
      nombre: "username",
      valorDefecto: "admin@example.com",
    } satisfies ConvertirParametroInput);
  });

  it("Cancel calls onCancel", () => {
    const onCancel = jest.fn();
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("ESC closes the modal", () => {
    const onCancel = jest.fn();
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows errorMsg when provided", () => {
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={noop}
        errorMsg="Ya existe un parámetro con ese nombre"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Ya existe");
  });

  it("shows busy state", () => {
    render(
      <ConvertirParametroModal
        elementLabel="X"
        onSubmit={noop}
        onCancel={noop}
        busy
      />,
    );
    expect(screen.getByTestId("submit-button")).toBeDisabled();
    expect(screen.getByTestId("submit-button").textContent).toContain(
      "Creando…",
    );
  });

  it("preview updates as the user types the name", () => {
    render(
      <ConvertirParametroModal
        elementLabel="Username"
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("parametro-nombre-input"), {
      target: { value: "saldo_inicial" },
    });
    expect(screen.getByText(/\{\{saldo_inicial\}\}/)).toBeInTheDocument();
  });
});
