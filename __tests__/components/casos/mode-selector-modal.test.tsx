/**
 * Tests for components/casos/mode-selector-modal.tsx (HU-G20).
 *
 * Cubre:
 *   - Renderiza título y 2 tarjetas (Grabar / Subir) cuando open=true.
 *   - No renderiza cuando open=false.
 *   - "Grabar Acción" navega a /casos/grabar/nueva (con proyectoId si está).
 *   - "Subir Script" dispara el evento global 'acta:open-create-caso-form'.
 *   - Cancelar / Escape / click-outside cierra el modal.
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModeSelectorModal } from "@/components/casos/mode-selector-modal";

// Mock next/navigation router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ModeSelectorModal (HU-G20)", () => {
  it("no renderiza nada cuando open=false", () => {
    render(
      <ModeSelectorModal open={false} onClose={jest.fn()} />,
    );
    expect(screen.queryByTestId("mode-selector-modal")).not.toBeInTheDocument();
  });

  it("renderiza título, las 2 tarjetas y botón Cancelar cuando open=true", () => {
    render(<ModeSelectorModal open={true} onClose={jest.fn()} />);

    expect(screen.getByTestId("mode-selector-modal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "¿Cómo quieres crear tu caso de prueba?",
      }),
    ).toBeInTheDocument();

    // Las 2 tarjetas
    expect(screen.getByTestId("mode-selector-card-grabar")).toBeInTheDocument();
    expect(screen.getByTestId("mode-selector-card-subir")).toBeInTheDocument();
    expect(screen.getByText("Grabar Acción (No-Code)")).toBeInTheDocument();
    expect(screen.getByText("Subir Script Playwright")).toBeInTheDocument();

    // Cancelar
    expect(screen.getByTestId("mode-selector-cancel")).toBeInTheDocument();
  });

  it("'Grabar Acción' navega a /casos/grabar/nueva y cierra el modal", () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mode-selector-card-grabar"));

    expect(mockPush).toHaveBeenCalledWith("/casos/grabar/nueva");
    expect(onClose).toHaveBeenCalled();
  });

  it("'Grabar Acción' propaga proyectoId en la URL", () => {
    const onClose = jest.fn();
    render(
      <ModeSelectorModal
        open={true}
        onClose={onClose}
        proyectoId="proy-99"
      />,
    );

    fireEvent.click(screen.getByTestId("mode-selector-card-grabar"));

    expect(mockPush).toHaveBeenCalledWith(
      "/casos/grabar/nueva?proyectoId=proy-99",
    );
  });

  it("'Subir Script' cierra el modal y emite el evento global acta:open-create-caso-form", () => {
    const onClose = jest.fn();
    const listener = jest.fn();
    window.addEventListener("acta:open-create-caso-form", listener);

    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mode-selector-card-subir"));

    expect(onClose).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener("acta:open-create-caso-form", listener);
  });

  it("botón Cancelar invoca onClose", () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mode-selector-cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("Escape cierra el modal", () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("click en el backdrop cierra el modal; click dentro NO", () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    const dialog = screen.getByTestId("mode-selector-modal");
    // Click directo en el contenedor = click en el backdrop
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);

    // Click en una tarjeta NO debe cerrar (porque no es el backdrop)
    onClose.mockClear();
    fireEvent.click(screen.getByTestId("mode-selector-card-grabar"));
    // El handler de la tarjeta llama onClose() → 1 vez
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
