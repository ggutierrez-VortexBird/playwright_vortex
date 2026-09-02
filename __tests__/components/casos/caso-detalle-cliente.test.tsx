/**
 * Tests for components/casos/caso-detalle-cliente.tsx (HU-G16).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ejecucionId: "ej-1" }),
  });
});

const baseCaso = {
  id: "caso-1",
  codigo: "CP-ABCDEF",
  nombre: "Consulta de saldo",
  script: "import { test, expect } from '@playwright/test';\n\ntest('Consulta de saldo', async ({ page }) => {\n  await page.goto('https://example.com');\n});",
  scriptFileName: "consulta-de-saldo.spec.ts",
  origen: "grabador",
  activo: true,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  parametros: [],
};

describe("CasoDetalleCliente (HU-G16)", () => {
  it("renders the title, codigo, origen and script", () => {
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Consulta de saldo" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CP-ABCDEF/)).toBeInTheDocument();
    expect(screen.getByText(/origen: grabador/)).toBeInTheDocument();
    expect(screen.getByTestId("script-block").textContent).toContain(
      "await page.goto",
    );
  });

  it("renders the back link", () => {
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    const link = screen.getByTestId("back-link");
    expect(link).toHaveAttribute("href", "/casos");
    expect(link.textContent).toContain("Volver");
  });

  it("renders the Ejecutar button", () => {
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    expect(screen.getByTestId("ejecutar-button")).toBeInTheDocument();
  });

  it("renders parameters with {{nombre}} chips", () => {
    render(
      <CasoDetalleCliente
        caso={{
          ...baseCaso,
          parametros: [
            {
              id: "p1",
              nombre: "usuario",
              valorDefecto: "admin",
              origen: "manual",
              enUso: true,
            },
          ],
        }}
        backHref="/casos"
      />,
    );
    expect(screen.getByText("{{usuario}}")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("masks credenciales parametros", () => {
    render(
      <CasoDetalleCliente
        caso={{
          ...baseCaso,
          parametros: [
            {
              id: "p1",
              nombre: "pwd",
              valorDefecto: "supersecret",
              origen: "credencial",
              enUso: true,
            },
          ],
        }}
        backHref="/casos"
      />,
    );
    expect(screen.queryByText("supersecret")).not.toBeInTheDocument();
    // maskValue("supersecret") = "•••••••cret" (7 bullets + last 4 chars).
    const body = screen.getByTestId("parametros-panel-body");
    expect(body.textContent).toContain("cret");
    expect(body.textContent).toContain("•");
  });

  it("Ejecutar button POSTs and redirects via window.location.href", async () => {
    const originalLocation = window.location;
    // @ts-expect-error - override location for the test
    delete window.location;
    (window as unknown as { location: { href: string } }).location = {
      href: "",
    };

    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    fireEvent.click(screen.getByTestId("ejecutar-button"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-1/ejecutar",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect((window as unknown as { location: { href: string } }).location.href).toBe(
        "/ejecuciones/ej-1",
      );
    });

    (window as unknown as { location: typeof originalLocation }).location = originalLocation;
  });

  it("shows errorMsg when ejecutar fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Worker caído" }),
    });
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    fireEvent.click(screen.getByTestId("ejecutar-button"));

    await waitFor(() => {
      expect(screen.getByTestId("caso-detalle-error").textContent).toContain(
        "Worker caído",
      );
    });
  });

  it("Ejecutar button is disabled while busy", async () => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ ejecucionId: "ej-1" }),
              } as Response),
            500,
          ),
        ),
    );
    render(<CasoDetalleCliente caso={baseCaso} backHref="/casos" />);
    fireEvent.click(screen.getByTestId("ejecutar-button"));
    expect(screen.getByTestId("ejecutar-button")).toBeDisabled();
    expect(screen.getByText(/Encolando/i)).toBeInTheDocument();
  });
});
