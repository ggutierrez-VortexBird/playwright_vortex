// __tests__/components/grabador/sesiones-recuperables-client.test.tsx
// HU-GR-1 / HU-GR-2 — UI de la página /casos/grabar con sesiones recuperables

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args),
  }),
}));

function mockSesion(over: Record<string, unknown> = {}) {
  return {
    id: "ses-1",
    nombre: "Login flow",
    urlInicial: "https://example.com/login",
    ambiente: "QA",
    navegador: "chromium",
    estado: "detenida",
    mensajeError: null,
    startedAt: "2026-08-12T10:00:00.000Z",
    endedAt: "2026-08-12T10:05:00.000Z",
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-12T10:05:00.000Z",
    reanudable: true,
    proyecto: { nombre: "P1" },
    credencial: { nombre: "Demo" },
    _count: { pasos: 4 },
    ...over,
  };
}

describe("SesionesRecuperablesClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza una fila por sesión", () => {
    render(
      <SesionesRecuperablesClient
        sesiones={[
          mockSesion({ id: "ses-1", nombre: "A" }),
          mockSesion({ id: "ses-2", nombre: "B" }),
        ]}
      />,
    );
    expect(screen.getAllByTestId("sesion-row")).toHaveLength(2);
  });

  it("muestra el badge de estado con texto legible", () => {
    render(
      <SesionesRecuperablesClient
        sesiones={[mockSesion({ estado: "detenida" })]}
      />,
    );
    const badge = screen.getByTestId("sesion-estado-badge");
    expect(badge.textContent).toMatch(/Detenida/i);
  });

  it("muestra botón Reanudar para sesiones reanudables", () => {
    render(
      <SesionesRecuperablesClient
        sesiones={[mockSesion({ estado: "detenida", reanudable: true })]}
      />,
    );
    expect(screen.getByTestId("sesion-reanudar-button")).toBeInTheDocument();
  });

  it("NO muestra botón Reanudar para sesiones 'guardada' (no reanudable)", () => {
    render(
      <SesionesRecuperablesClient
        sesiones={[
          mockSesion({ estado: "guardada", reanudable: false }),
        ]}
      />,
    );
    expect(screen.queryByTestId("sesion-reanudar-button")).not.toBeInTheDocument();
  });

  it("al click Reanudar → POST /reanudar → router.push a /casos/grabar/[id]", async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, estado: "activa" }),
    })) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      render(
        <SesionesRecuperablesClient
          sesiones={[mockSesion({ id: "ses-42" })]}
        />,
      );
      fireEvent.click(screen.getByTestId("sesion-reanudar-button"));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/casos/grabar/ses-42");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/grabador/sesiones/ses-42/reanudar",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("muestra error si /reanudar falla", async () => {
    const mockFetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: "cannot_resume",
        message: "No se puede reanudar una sesión en estado 'guardada'",
      }),
    })) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      render(<SesionesRecuperablesClient sesiones={[mockSesion()]} />);
      fireEvent.click(screen.getByTestId("sesion-reanudar-button"));

      await waitFor(() => {
        expect(screen.getByTestId("sesiones-error")).toBeInTheDocument();
      });

      expect(screen.getByTestId("sesiones-error").textContent).toContain(
        "guardada",
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("al click Descartar → DELETE + router.refresh", async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;
    // window.confirm siempre true
    window.confirm = jest.fn(() => true);

    try {
      render(
        <SesionesRecuperablesClient
          sesiones={[mockSesion({ id: "ses-del" })]}
        />,
      );
      fireEvent.click(screen.getByTestId("sesion-descartar-button"));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/grabador/sesiones/ses-del",
        expect.objectContaining({ method: "DELETE" }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("link 'Revisar' apunta a /casos/grabar/[id]/revisar", () => {
    render(
      <SesionesRecuperablesClient
        sesiones={[mockSesion({ id: "ses-rev" })]}
      />,
    );
    const link = screen.getByTestId("sesion-revisar-link");
    expect(link).toHaveAttribute("href", "/casos/grabar/ses-rev/revisar");
  });
});