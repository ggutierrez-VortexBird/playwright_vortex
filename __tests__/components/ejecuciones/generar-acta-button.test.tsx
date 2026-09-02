// __tests__/components/ejecuciones/generar-acta-button.test.tsx
// HU-G19 — botón generar acta de evidencia

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerarActaButton } from "@/components/ejecuciones/generar-acta-button";

describe("GenerarActaButton", () => {
  it("muestra el botón 'Generar acta de evidencia' cuando no hay acta previa", () => {
    render(<GenerarActaButton ejecucionId="ejec-1" />);
    expect(screen.getByTestId("generar-acta-button")).toBeInTheDocument();
    expect(screen.getByText(/Generar acta de evidencia/i)).toBeInTheDocument();
  });

  it("muestra el link de descarga cuando ya existe acta previa", () => {
    render(
      <GenerarActaButton
        ejecucionId="ejec-1"
        initialActa={{
          id: "acta-1",
          consecutivo: "ACE-2026-0001",
          pdfPath: "/storage/actas/ACE-2026-0001.pdf",
          downloadUrl: "/api/actas/acta-1/download",
        }}
      />,
    );
    const link = screen.getByTestId("acta-download-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/actas/acta-1/download");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.textContent).toContain("ACE-2026-0001");
    expect(screen.queryByTestId("generar-acta-button")).not.toBeInTheDocument();
  });

  it("al click → POST /api/ejecuciones/[id]/acta → muestra link de descarga", async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        actaId: "acta-99",
        consecutivo: "ACE-2026-0042",
        pdfPath: "/storage/actas/ACE-2026-0042.pdf",
        downloadUrl: "/api/actas/acta-99/download",
      }),
    })) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      render(<GenerarActaButton ejecucionId="ejec-42" />);
      fireEvent.click(screen.getByTestId("generar-acta-button"));

      await waitFor(() => {
        expect(screen.getByTestId("acta-download-link")).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ejecuciones/ejec-42/acta",
        expect.objectContaining({ method: "POST" }),
      );
      const link = screen.getByTestId("acta-download-link");
      expect(link).toHaveAttribute("href", "/api/actas/acta-99/download");
      expect(link.textContent).toContain("ACE-2026-0042");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("muestra mensaje de error si el endpoint falla", async () => {
    const mockFetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "render_failed", message: "chrome se cayó" }),
    })) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      render(<GenerarActaButton ejecucionId="ejec-1" />);
      fireEvent.click(screen.getByTestId("generar-acta-button"));

      await waitFor(() => {
        expect(screen.getByTestId("generar-acta-error")).toBeInTheDocument();
      });

      expect(screen.getByTestId("generar-acta-error").textContent).toContain(
        "chrome se cayó",
      );
      // El botón vuelve a estar disponible
      expect(screen.getByTestId("generar-acta-button")).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("muestra 'Generando acta…' mientras la request está en vuelo", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const mockFetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      render(<GenerarActaButton ejecucionId="ejec-1" />);
      fireEvent.click(screen.getByTestId("generar-acta-button"));

      await waitFor(() => {
        expect(screen.getByText(/Generando acta/i)).toBeInTheDocument();
      });

      // El botón debe estar deshabilitado mientras espera
      const button = screen.getByTestId("generar-acta-button");
      expect(button).toBeDisabled();

      // Resolvemos la promise
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          actaId: "acta-x",
          consecutivo: "ACE-2026-0001",
          pdfPath: "/x.pdf",
          downloadUrl: "/api/actas/acta-x/download",
        }),
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});