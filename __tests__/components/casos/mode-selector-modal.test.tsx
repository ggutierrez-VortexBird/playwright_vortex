/**
 * Tests for components/casos/mode-selector-modal.tsx (HU-G20).
 *
 * Cubre:
 *   - Renderiza título y 2 tarjetas (Grabar / Subir) cuando open=true.
 *   - No renderiza cuando open=false.
 *   - Ninguna tarjeta aparece preseleccionada (sin estilos "activos" fijos).
 *   - "Subir Script" embebe el CreateCasoForm en el mismo modal (sin cerrar ni navegar).
 *   - "Grabar Acción" embebe el flujo de grabación en el mismo modal (sin navegar).
 *   - El botón "Volver" del paso 2 regresa al paso 1 sin cerrar el modal.
 *   - Cancelar / Escape / click-outside cierra el modal.
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  ) as jest.Mock;
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
        name: "¿Cómo querés crear tu caso de prueba?",
      }),
    ).toBeInTheDocument();

    // Las 2 tarjetas
    const grabarCard = screen.getByTestId("mode-selector-card-grabar");
    const subirCard = screen.getByTestId("mode-selector-card-subir");
    expect(grabarCard).toBeInTheDocument();
    expect(subirCard).toBeInTheDocument();
    expect(screen.getByText("Grabar acción (No-Code)")).toBeInTheDocument();
    expect(screen.getByText("Subir Script Playwright")).toBeInTheDocument();

    // Ninguna tarjeta debe verse "preseleccionada" (mismas clases base para ambas)
    expect(grabarCard.className).toBe(subirCard.className);

    // Cancelar
    expect(screen.getByTestId("mode-selector-cancel")).toBeInTheDocument();

    // No hay botón "Volver" en el paso 1
    expect(screen.queryByTestId("mode-selector-back")).not.toBeInTheDocument();
  });

  it("'Subir Script' embebe el CreateCasoForm en el mismo modal, sin cerrar", async () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mode-selector-card-subir"));

    await waitFor(() => {
      expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("mode-selector-modal")).toBeInTheDocument();
    expect(screen.getByTestId("mode-selector-back")).toBeInTheDocument();
  });

  it("'Grabar Acción' embebe el flujo de grabación en el mismo modal, sin navegar", async () => {
    const onClose = jest.fn();
    render(
      <ModeSelectorModal open={true} onClose={onClose} proyectoId="proy-99" />,
    );

    fireEvent.click(screen.getByTestId("mode-selector-card-grabar"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/proyectos/proy-99/credenciales",
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/nombre del caso/i)).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("'Volver' regresa del paso 2 al paso 1 sin cerrar el modal", async () => {
    const onClose = jest.fn();
    render(<ModeSelectorModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mode-selector-card-subir"));
    await waitFor(() => {
      expect(screen.getByTestId("mode-selector-back")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("mode-selector-back"));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "¿Cómo querés crear tu caso de prueba?",
      }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
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
    expect(onClose).not.toHaveBeenCalled();

    cleanup();
  });
});
