// El conteo de pasos viene de `pasosCount`, calculado en el servidor desde el specCode.

import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";

const pushMock = jest.fn();
const refreshMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

const baseSesion = {
  id: "ses-1",
  nombre: "Login exitoso",
  urlInicial: "https://example.com",
  ambiente: "QA",
  navegador: "chromium",
  mensajeError: null,
  startedAt: null,
  endedAt: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:05:00.000Z",
  proyecto: { nombre: "Proyecto A" },
  credencial: null,
  pasosCount: 7,
};

describe("SesionesRecuperablesClient", () => {
  it("no renderiza ningún botón Reanudar, para ningún estado", () => {
    for (const estado of ["activa", "pausada", "detenida", "guardada", "error"]) {
      const { unmount } = render(
        <SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado }]} />,
      );
      expect(screen.queryByTestId("sesion-reanudar-button")).not.toBeInTheDocument();
      expect(screen.queryByText(/reanudar/i)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("muestra el conteo real de pasos, no 0 fijo", () => {
    render(<SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado: "detenida" }]} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("el enlace Revisar sigue siendo la vía de recuperación real", () => {
    render(<SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado: "detenida" }]} />);
    expect(screen.getByTestId("sesion-revisar-link")).toHaveAttribute(
      "href",
      "/casos/grabar/ses-1/revisar",
    );
  });

  it("el mensaje de confirmar Descartar usa el conteo real de pasos", async () => {
    render(<SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado: "detenida" }]} />);
    fireEvent.click(screen.getByTestId("sesion-descartar-button"));

    await waitFor(() => {
      expect(screen.getByText(/7 paso\(s\) capturado\(s\)/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /descartar sesión/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });

  it("Descartar solo se oculta cuando la sesión ya está descartada", () => {
    render(<SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado: "descartada" }]} />);
    expect(screen.queryByTestId("sesion-descartar-button")).not.toBeInTheDocument();
  });
});
