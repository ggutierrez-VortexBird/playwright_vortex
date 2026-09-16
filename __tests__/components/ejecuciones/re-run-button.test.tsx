/**
 * Tests for components/ejecuciones/re-run-button.tsx.
 *
 * El componente invoca `dispararEjecucion` (server action) y luego hace
 * router.push al detalle de la nueva ejecución. Como server actions no se
 * pueden ejecutar bajo jsdom, mockeamos directamente la acción.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReRunButton } from "@/components/ejecuciones/re-run-button";

const mockPush = jest.fn();
const mockDispararEjecucion = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/lib/ejecuciones/actions", () => ({
  dispararEjecucion: (...args: unknown[]) => mockDispararEjecucion(...args),
}));

describe("ReRunButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (window.alert as jest.Mock).mockRestore();
  });

  it("renders the button with the default label", () => {
    render(<ReRunButton casoPruebaId="caso-1" />);
    const btn = screen.getByRole("button", { name: /volver a ejecutar/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
  });

  it("calls dispararEjecucion with the casoPruebaId when clicked", async () => {
    mockDispararEjecucion.mockResolvedValue({ id: "ejec-99", estado: "pendiente" });

    render(<ReRunButton casoPruebaId="caso-abc" />);
    fireEvent.click(screen.getByRole("button", { name: /volver a ejecutar/i }));

    await waitFor(() => {
      expect(mockDispararEjecucion).toHaveBeenCalledWith("caso-abc");
    });
  });

  it("navigates to /ejecuciones/{id} after a successful re-run", async () => {
    mockDispararEjecucion.mockResolvedValue({ id: "ejec-99", estado: "pendiente" });

    render(<ReRunButton casoPruebaId="caso-1" />);
    fireEvent.click(screen.getByRole("button", { name: /volver a ejecutar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/ejecuciones/ejec-99");
    });
  });

  it("shows the 'Lanzando…' label and disables the button while loading", async () => {
    let resolve!: (v: { id: string }) => void;
    mockDispararEjecucion.mockImplementation(
      () => new Promise((res) => { resolve = res; }),
    );

    render(<ReRunButton casoPruebaId="caso-1" />);
    fireEvent.click(screen.getByRole("button", { name: /volver a ejecutar/i }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /lanzando/i });
      expect(btn).toBeDisabled();
    });

    // Resolvemos para no dejar la promesa colgando
    resolve({ id: "ejec-1" });
  });

  it("shows an alert when dispararEjecucion throws", async () => {
    mockDispararEjecucion.mockRejectedValue(new Error("Sin permisos"));

    render(<ReRunButton casoPruebaId="caso-1" />);
    fireEvent.click(screen.getByRole("button", { name: /volver a ejecutar/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Sin permisos");
    });
  });
});