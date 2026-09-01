/**
 * Tests for components/grabador/agregar-paso-manual-modal.tsx (HU-G10).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import {
  AgregarPasoManualModal,
  type PasoManualOption,
} from "@/components/grabador/agregar-paso-manual-modal";

const opciones: PasoManualOption[] = [
  { id: "p1", numero: 1, descripcion: "Abrir portal" },
  { id: "p2", numero: 2, descripcion: "Click en login" },
];

const noop = () => undefined;

describe("AgregarPasoManualModal (HU-G10)", () => {
  it("renders the modal with default type=verificar", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("agregar-paso-manual-modal")).toBeInTheDocument();
    expect(screen.getByTestId("tipo-verificar")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("assertion-kind-select")).toBeInTheDocument();
  });

  it("shows the position selector with 'Al final' default", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    const sel = screen.getByTestId("posicion-select");
    expect(sel).toHaveValue("");
    const options = sel.querySelectorAll("option");
    expect(options[0].textContent).toContain("Al final");
  });

  it("switching to 'clic' shows the selector input and hides assertion fields", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-clic"));
    expect(screen.getByTestId("selector-input")).toBeInTheDocument();
    expect(
      screen.queryByTestId("assertion-kind-select"),
    ).not.toBeInTheDocument();
  });

  it("switching to 'escribir' shows valor input", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-escribir"));
    expect(screen.getByTestId("valor-input")).toBeInTheDocument();
  });

  it("switching to 'navegar' shows url input", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-navegar"));
    expect(screen.getByTestId("url-input")).toBeInTheDocument();
  });

  it("switching to 'esperar' shows duracion input", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-esperar"));
    expect(screen.getByTestId("duracion-input")).toBeInTheDocument();
  });

  it("submit is enabled for verificar when assertionKind=visible", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    // Default assertion = visible, no valorEsperado needed.
    expect(screen.getByTestId("submit-button")).not.toBeDisabled();
  });

  it("submit is disabled for verificar (texto_igual) without valorEsperado", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_igual" },
    });
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("calls onSubmit with the right payload for verificar", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "texto_igual" },
    });
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "Hola" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "verificar",
        valorEsperado: "Hola",
        assertionKind: "texto_igual",
        numero: null,
      }),
    );
  });

  it("calls onSubmit with the right payload for escribir", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-escribir"));
    fireEvent.change(screen.getByTestId("selector-input"), {
      target: { value: "input#user" },
    });
    fireEvent.change(screen.getByTestId("valor-input"), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "escribir",
        descripcion: "input#user",
        valor: "admin",
      }),
    );
  });

  it("calls onSubmit with the right payload for esperar (with default descripcion)", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-esperar"));
    fireEvent.change(screen.getByTestId("duracion-input"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "esperar",
        valor: "1500",
        descripcion: "Esperar 1500ms",
      }),
    );
  });

  it("calls onSubmit with the right payload for navegar", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-navegar"));
    fireEvent.change(screen.getByTestId("url-input"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "navegar",
        valor: "https://example.com",
        descripcion: "Abrir «https://example.com»",
      }),
    );
  });

  it("includes the position in the payload", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        defaultPosicion={1}
        onSubmit={onSubmit}
        onCancel={noop}
      />,
    );
    fireEvent.change(screen.getByTestId("assertion-kind-select"), {
      target: { value: "visible" },
    });
    // valorEsperado not required for visible
    fireEvent.change(screen.getByTestId("valor-esperado-input"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByTestId("submit-button"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        numero: 1,
      }),
    );
  });

  it("submit is disabled for esperar with negative duration", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("tipo-esperar"));
    fireEvent.change(screen.getByTestId("duracion-input"), {
      target: { value: "-100" },
    });
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = jest.fn();
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
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
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows errorMsg when provided", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
        errorMsg="No se pudo crear el paso"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "No se pudo crear el paso",
    );
  });

  it("submit is disabled when busy=true", () => {
    render(
      <AgregarPasoManualModal
        opcionesPosicion={opciones}
        onSubmit={noop}
        onCancel={noop}
        busy
      />,
    );
    expect(screen.getByTestId("submit-button")).toBeDisabled();
    expect(screen.getByTestId("submit-button").textContent).toContain(
      "Agregando…",
    );
  });
});
