/**
 * Tests for components/grabador/editar-paso-modal.tsx (HU-G9).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { EditarPasoModal } from "@/components/grabador/editar-paso-modal";

const baseProps = {
  pasoId: "paso-1",
  numero: 3,
  descripcionInicial: "Click en «Submit»",
  selectorPrincipalInicial: { tag: "button", testId: "submit" },
  valorInicial: null as string | null,
  parametrosConocidos: [] as string[],
};

const noop = () => undefined;

describe("EditarPasoModal (HU-G9)", () => {
  it("renders the modal with the initial values", () => {
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={noop} onCancel={noop} />);
    expect(screen.getByTestId("editar-paso-modal")).toBeInTheDocument();
    expect(screen.getByText(/Editar paso 03/)).toBeInTheDocument();
    expect(screen.getByTestId("descripcion-input")).toHaveValue(
      "Click en «Submit»",
    );
  });

  it("pretty-prints the selectorPrincipal JSON in the textarea", () => {
    render(
      <EditarPasoModal
        {...baseProps}
        selectorPrincipalInicial={{ tag: "button", testId: "submit" }}
        onSave={noop}
        onDelete={noop}
        onCancel={noop}
      />,
    );
    const textarea = screen.getByTestId("selector-input");
    expect(textarea.textContent || (textarea as HTMLTextAreaElement).value).toContain(
      '"tag"',
    );
  });

  it("shows JSON parse error when the selector textarea has invalid JSON", () => {
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={noop} onCancel={noop} />);
    fireEvent.change(screen.getByTestId("selector-input"), {
      target: { value: "{not json" },
    });
    expect(screen.getByText(/JSON inválido/)).toBeInTheDocument();
    expect(screen.getByTestId("save-button")).toBeDisabled();
  });

  it("save button is disabled when descripcion is empty (after trim)", () => {
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={noop} onCancel={noop} />);
    fireEvent.change(screen.getByTestId("descripcion-input"), {
      target: { value: "   " },
    });
    expect(screen.getByTestId("save-button")).toBeDisabled();
  });

  it("calls onSave with the right payload", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<EditarPasoModal {...baseProps} onSave={onSave} onDelete={noop} onCancel={noop} />);
    fireEvent.change(screen.getByTestId("descripcion-input"), {
      target: { value: "Click en «Go»" },
    });
    fireEvent.change(screen.getByTestId("valor-input"), {
      target: { value: "nuevo-valor" },
    });
    fireEvent.click(screen.getByTestId("save-button"));
    expect(onSave).toHaveBeenCalledWith({
      descripcion: "Click en «Go»",
      selectorPrincipal: { tag: "button", testId: "submit" },
      valor: "nuevo-valor",
      actualizarDefaultParametro: false,
    });
  });

  it("Cancel button calls onCancel", () => {
    const onCancel = jest.fn();
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={noop} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("ESC closes the modal", () => {
    const onCancel = jest.fn();
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={noop} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows 'actualizar default' checkbox only when {{nombre}} is present in valor/descripcion", () => {
    render(
      <EditarPasoModal
        {...baseProps}
        descripcionInicial="Escribir {{usuario}} en «Username»"
        valorInicial="{{usuario}}"
        parametrosConocidos={["usuario"]}
        onSave={noop}
        onDelete={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("actualizar-default-checkbox")).toBeInTheDocument();
  });

  it("does NOT show 'actualizar default' checkbox when there are no {{nombre}} matches", () => {
    render(
      <EditarPasoModal
        {...baseProps}
        descripcionInicial="Click en «Submit»"
        valorInicial={null}
        parametrosConocidos={["usuario"]}
        onSave={noop}
        onDelete={noop}
        onCancel={noop}
      />,
    );
    expect(
      screen.queryByTestId("actualizar-default-checkbox"),
    ).not.toBeInTheDocument();
  });

  it("delete flow: first click shows confirm, second confirms", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={onDelete} onCancel={noop} />);
    fireEvent.click(screen.getByTestId("delete-button"));
    expect(screen.getByTestId("delete-confirm-row")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("delete-confirm"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("delete confirm can be cancelled", () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<EditarPasoModal {...baseProps} onSave={noop} onDelete={onDelete} onCancel={noop} />);
    fireEvent.click(screen.getByTestId("delete-button"));
    expect(screen.getByTestId("delete-confirm-row")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("delete-cancel"));
    expect(screen.queryByTestId("delete-confirm-row")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows errorMsg when provided", () => {
    render(
      <EditarPasoModal
        {...baseProps}
        onSave={noop}
        onDelete={noop}
        onCancel={noop}
        errorMsg="Algo falló al guardar"
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Algo falló al guardar");
  });

  it("submit is disabled when busy=true", () => {
    render(
      <EditarPasoModal
        {...baseProps}
        onSave={noop}
        onDelete={noop}
        onCancel={noop}
        busy
      />,
    );
    expect(screen.getByTestId("save-button")).toBeDisabled();
    expect(screen.getByTestId("save-button").textContent).toContain("Guardando…");
  });

  it("empty selector textarea sends selectorPrincipal=null", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<EditarPasoModal {...baseProps} onSave={onSave} onDelete={noop} onCancel={noop} />);
    fireEvent.change(screen.getByTestId("selector-input"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("save-button"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ selectorPrincipal: null }),
    );
  });
});
