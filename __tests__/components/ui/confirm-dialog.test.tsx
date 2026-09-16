/**
 * Tests for components/ui/confirm-dialog.tsx.
 *
 * Notas:
 *   - El componente es un <div role="dialog"> propio; NO usa el componente
 *     compartido <Modal>, así que NO tiene handler de Escape. El test
 *     correspondiente verifica que la tecla Escape no cierra el diálogo
 *     (comportamiento actual).
 *   - El backdrop cierra el diálogo al hacer click directamente sobre él.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="¿Eliminar?"
        description="Esta acción no se puede deshacer"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, description and both buttons when open=true", () => {
    render(
      <ConfirmDialog
        open
        title="¿Eliminar caso?"
        description="Esta acción no se puede deshacer"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("¿Eliminar caso?")).toBeInTheDocument();
    expect(screen.getByText("Esta acción no se puede deshacer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop is clicked", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onCancel when the inner panel is clicked", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    // Click sobre el título — el handler comprueba e.target === e.currentTarget
    fireEvent.click(screen.getByText("¿Eliminar?"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("pressing Escape does NOT call onCancel (componente sin handler de teclado)", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disables confirm button and shows loading label while isLoading", () => {
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        confirmLabel="Eliminar"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        isLoading
      />,
    );
    const btn = screen.getByRole("button", { name: "Eliminando…" });
    expect(btn).toBeDisabled();
  });

  it("renders itemLabel when provided", () => {
    render(
      <ConfirmDialog
        open
        title="¿Eliminar?"
        description="..."
        itemLabel="catastro · Alcaldía de Medellín"
        itemColor="#C9822F"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText("catastro · Alcaldía de Medellín")).toBeInTheDocument();
  });
});