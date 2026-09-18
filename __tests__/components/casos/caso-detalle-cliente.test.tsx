/**
 * Tests for components/casos/caso-detalle-cliente.tsx (HU-G16).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";

// Monaco Editor is loaded via next/dynamic with a then() chain - mock it explicitly
jest.mock("@monaco-editor/react", () => ({
  Editor: function MockEditor({ value, onChange }: any) {
    return (
      <textarea
        data-testid="monaco-editor-mock"
        value={value ?? ""}
        onChange={(e: any) => onChange?.(e.target.value)}
      />
    );
  },
  default: function MockEditor({ value, onChange }: any) {
    return (
      <textarea
        data-testid="monaco-editor-mock"
        value={value ?? ""}
        onChange={(e: any) => onChange?.(e.target.value)}
      />
    );
  },
}));

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
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    expect(
      screen.getByRole("heading", { level: 1, name: "Consulta de saldo" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CP-ABCDEF/)).toBeInTheDocument();
    expect(screen.getByText("Origen: Grabador")).toBeInTheDocument();
    // script-editor-container is present (Monaco loads via dynamic, which shows loading state in jsdom)
    expect(screen.getByTestId("script-editor-container")).toBeInTheDocument();
  });

  it("renders the back link", () => {
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    const link = screen.getByTestId("back-link");
    expect(link).toHaveAttribute("href", "/casos");
    expect(link.textContent).toContain("Volver");
  });

  it("renders the Ejecutar button", () => {
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    expect(screen.getByTestId("ejecutar-button")).toBeInTheDocument();
  });

  it("renders parameters with {{nombre}} chips", () => {
    render(
      <BreadcrumbProvider>
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
        />
      </BreadcrumbProvider>,
    );
    expect(screen.getByText("{{usuario}}")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("masks credenciales parametros", () => {
    render(
      <BreadcrumbProvider>
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
        />
      </BreadcrumbProvider>,
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

    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
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
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("ejecutar-button"));

    await waitFor(() => {
      expect(screen.getByTestId("caso-detalle-error").textContent).toContain(
        "Worker caído",
      );
    });
  });

  it("shows the script read-only by default, with an 'Editar script' button", () => {
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    expect(screen.getByTestId("script-editor-container")).toBeInTheDocument();
    expect(screen.getByTestId("editar-script-button")).toBeInTheDocument();
  });

  it("autoAbrirEditorScript abre el editor ya desplegado al montar", async () => {
    // Llega desde la acción "Script" de la tabla de Casos — el usuario no
    // debería tener que hacer un clic más una vez que entró con esa intención.
    render(
      <BreadcrumbProvider>
        <CasoDetalleCliente caso={baseCaso} backHref="/casos" autoAbrirEditorScript />
      </BreadcrumbProvider>,
    );
    expect(await screen.findByTestId("script-editor-container")).toBeInTheDocument();
    expect(screen.queryByTestId("script-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editar-script-button")).not.toBeInTheDocument();
  });

  it("Editar script swaps the read-only block for the editor", async () => {
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("editar-script-button"));

    expect(await screen.findByTestId("script-editor-container")).toBeInTheDocument();
    expect(screen.queryByTestId("script-block")).not.toBeInTheDocument();
    expect(screen.getByTestId("guardar-script-button")).toBeInTheDocument();
    expect(screen.getByTestId("cancelar-script-button")).toBeInTheDocument();
  });

  it("Cancelar descarta la edición y vuelve a la vista de solo lectura", async () => {
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("editar-script-button"));
    await screen.findByTestId("script-editor-container");

    fireEvent.click(screen.getByTestId("cancelar-script-button"));

    // Editor stays visible in read-only mode after cancel
    expect(screen.getByTestId("script-editor-container")).toBeInTheDocument();
  });

  it("Guardar cambios envía el texto editado por PUT y actualiza la vista", async () => {
    const newScript = "await page.goto('https://nuevo.example');";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...baseCaso, script: newScript }),
    });

    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("editar-script-button"));
    const textarea = await screen.findByTestId("monaco-editor-mock");

    fireEvent.change(textarea, {
      target: { value: newScript },
    });
    fireEvent.click(screen.getByTestId("guardar-script-button"));

    // Verify PUT was called with the new script in FormData
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-1",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    // Verify the PUT body contained the new script
    const putCall = mockFetch.mock.calls.find(
      ([url, opts]: any) => url === "/api/casos/caso-1" && opts?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const formData = putCall[1].body as FormData;
    expect(formData.get("script")).toBe(newScript);
    // Editor stays visible after successful save (back in read-only mode)
    expect(screen.getByTestId("script-editor-container")).toBeInTheDocument();
  });

  it("muestra el error del server si falla el guardado del script", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "script is required" }),
    });

    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("editar-script-button"));
    await screen.findByTestId("script-editor-container");
    fireEvent.click(screen.getByTestId("guardar-script-button"));

    await waitFor(() => {
      expect(screen.getByTestId("script-error").textContent).toContain(
        "script is required",
      );
    });
    // Sigue en modo edición — no se pierde lo que el usuario tipeó.
    expect(screen.getByTestId("script-editor-container")).toBeInTheDocument();
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
    render(<BreadcrumbProvider><CasoDetalleCliente caso={baseCaso} backHref="/casos" /></BreadcrumbProvider>);
    fireEvent.click(screen.getByTestId("ejecutar-button"));
    expect(screen.getByTestId("ejecutar-button")).toBeDisabled();
    expect(screen.getByText(/Encolando/i)).toBeInTheDocument();
  });
});
