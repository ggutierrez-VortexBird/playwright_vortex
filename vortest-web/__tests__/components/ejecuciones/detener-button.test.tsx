// __tests__/components/ejecuciones/detener-button.test.tsx
// Tests for HU-3 Botón Detener — DetenerButton client component
//
// Contrato real (components/ejecuciones/detener-button.tsx):
// - Props: { ejecucionId: string; visible: boolean }
// - Si `visible === false`, no renderiza nada (return null)
// - Renderiza un botón con clase "btn btn-stop", aria-label "Detener ejecución"
// - Al hacer click:
//   1. Llama `confirm()` — si retorna false, aborta (no fetch)
//   2. Hace fetch POST a `/api/ejecuciones/${ejecucionId}/detener`
//   3. Si 2xx → router.refresh()
//   4. Si 409 → setError("La ejecución ya terminó")
//   5. Si 403 → setError("Sin permisos")
//   6. Si 404 → setError("No encontrada")
//   7. Si otro → setError("Error al detener")
//   8. Si excepción → setError("Error de conexión")
// - Mientras `submitting`, muestra "⏳ Deteniendo…" y está disabled.

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// confirm() — mock global
const mockConfirm = jest.fn(() => true);
global.confirm = mockConfirm as unknown as typeof global.confirm;

describe("DetenerButton (HU-3 Botón Detener)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(true);
    mockRefresh.mockClear();
    mockPush.mockClear();
    global.fetch = jest.fn();
  });

  it("no renderiza nada cuando visible=false", () => {
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    const { container } = render(
      <DetenerButton ejecucionId="ejec-1" visible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el botón con texto 'Detener' cuando visible=true", () => {
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);
    const btn = screen.getByRole("button", { name: /detener ejecución/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/detener/i);
  });

  it("llama confirm() antes de hacer fetch", async () => {
    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringMatching(/detener la ejecución/i)
    );
  });

  it("NO llama a fetch si el usuario cancela el confirm()", async () => {
    mockConfirm.mockReturnValue(false);
    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hace POST al endpoint correcto cuando el usuario confirma", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ejec-1", estado: "cancelado" }),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-abc" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ejecuciones/ejec-abc/detener",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("llama router.refresh() después de éxito (200)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("muestra 'La ejecución ya terminó' cuando status es 409", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(screen.getByText(/la ejecución ya terminó/i)).toBeInTheDocument();
    });
  });

  it("muestra 'Sin permisos' cuando status es 403", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(screen.getByText(/sin permisos/i)).toBeInTheDocument();
    });
  });

  it("muestra 'No encontrada' cuando status es 404", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(screen.getByText(/no encontrada/i)).toBeInTheDocument();
    });
  });

  it("muestra 'Error al detener' cuando status es 500", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(screen.getByText(/error al detener/i)).toBeInTheDocument();
    });
  });

  it("muestra 'Error de conexión' cuando fetch throw", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network"));

    const user = userEvent.setup();
    const { DetenerButton } = require("@/components/ejecuciones/detener-button");
    render(<DetenerButton ejecucionId="ejec-1" visible={true} />);

    await user.click(screen.getByRole("button", { name: /detener ejecución/i }));

    await waitFor(() => {
      expect(screen.getByText(/error de conexión/i)).toBeInTheDocument();
    });
  });
});
