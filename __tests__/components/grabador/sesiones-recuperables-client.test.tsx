/**
 * Tests de components/grabador/sesiones-recuperables-client.tsx.
 *
 * El botón "Reanudar" (HU-GR-2) se retiró: asumía que el BrowserContext
 * seguía vivo en memoria del recorder-worker tras detener, esperando una
 * reconexión. El grabador sin ventana de Inspector (codegen-runner) cierra
 * siempre el proceso al detener, así que no queda nada a lo que
 * reconectarse — el botón navegaba y mostraba "sesión no encontrada".
 *
 * También cubre el conteo de pasos: antes venía de `_count.pasos`
 * (PasoGrabado), que el grabador actual nunca escribe y siempre daba 0.
 * Ahora es `pasosCount`, calculado server-side parseando el specCode.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  jest.spyOn(window, "confirm").mockReturnValue(true);
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
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("7 paso(s) capturado(s)"),
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });

  it("Descartar solo se oculta cuando la sesión ya está descartada", () => {
    render(<SesionesRecuperablesClient sesiones={[{ ...baseSesion, estado: "descartada" }]} />);
    expect(screen.queryByTestId("sesion-descartar-button")).not.toBeInTheDocument();
  });
});
