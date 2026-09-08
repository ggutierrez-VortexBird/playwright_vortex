/**
 * Tests de components/grabador/revisar-cliente.tsx.
 *
 * Cubre lo que cambió respecto de la versión de solo lectura:
 *   - El editor es editable (Monaco mockeado como <textarea>), no un <pre>.
 *   - "Guardar caso" y "Guardar y ejecutar" mandan el texto editado y
 *     navegan con router.push al redirectTo que devuelve el server —
 *     antes el componente ignoraba ese campo y se quedaba en la pantalla.
 *   - Si "Guardar y ejecutar" falla al encolar, el caso queda guardado y
 *     se avisa sin navegar a una ejecución que no existe.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RevisarCliente } from "@/components/grabador/revisar-cliente";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: jest.fn() }),
}));

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

const baseProps = {
  sesionId: "ses-abcdef12",
  nombre: "Login exitoso",
  specCode: "import { test } from '@playwright/test';\n\ntest('test', async () => {\n  await page.goto('https://x');\n});",
  casoPruebaId: null,
  suggestedFileName: "login-exitoso.spec.ts",
  urlInicial: "https://x",
  ambiente: "QA",
  navegador: "chromium",
  codegenFilePath: "/tmp/x.spec.ts",
};

describe("RevisarCliente", () => {
  it("muestra el spec en un editor editable, no en un bloque de solo lectura", async () => {
    render(<RevisarCliente {...baseProps} />);
    const editor = await screen.findByTestId("monaco-editor-mock");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveValue(baseProps.specCode);
    expect(screen.queryByTestId("revisar-spec-text")).not.toBeInTheDocument();
  });

  it("editar el código marca el estado como editado y habilita Descartar cambios", async () => {
    render(<RevisarCliente {...baseProps} />);
    const editor = await screen.findByTestId("monaco-editor-mock");

    fireEvent.change(editor, { target: { value: baseProps.specCode + "\n// nota" } });

    expect(screen.getByTestId("dirty-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("descartar-cambios-btn")).toBeInTheDocument();
  });

  it("Descartar cambios vuelve el editor al specCode original", async () => {
    render(<RevisarCliente {...baseProps} />);
    const editor = await screen.findByTestId("monaco-editor-mock");
    fireEvent.change(editor, { target: { value: "algo distinto" } });
    expect(editor).toHaveValue("algo distinto");

    fireEvent.click(screen.getByTestId("descartar-cambios-btn"));

    expect(editor).toHaveValue(baseProps.specCode);
    expect(screen.queryByTestId("dirty-indicator")).not.toBeInTheDocument();
  });

  it("Guardar caso manda el script tal cual cuando no se editó, y navega al redirectTo", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ casoPruebaId: "caso-1", redirectTo: "/casos/caso-1" }),
    });

    render(<RevisarCliente {...baseProps} />);
    fireEvent.click(screen.getByTestId("guardar-btn"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/grabador/sesiones/ses-abcdef12/guardar",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ script: undefined, ejecutar: false }),
        }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/casos/caso-1");
    });
  });

  it("Guardar caso manda el texto editado cuando el usuario lo cambió", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ casoPruebaId: "caso-1", redirectTo: "/casos/caso-1" }),
    });

    render(<RevisarCliente {...baseProps} />);
    const editado = "import { test } from '@playwright/test';\n// editado a mano";
    fireEvent.change(await screen.findByTestId("monaco-editor-mock"), {
      target: { value: editado },
    });
    fireEvent.click(screen.getByTestId("guardar-btn"));

    await waitFor(() => {
      const [, init] = mockFetch.mock.calls[0]!;
      expect(JSON.parse(init.body)).toEqual({ script: editado, ejecutar: false });
    });
  });

  it("Guardar y ejecutar manda ejecutar:true y navega a /ejecuciones/[id]", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        casoPruebaId: "caso-1",
        ejecucionId: "ej-1",
        redirectTo: "/ejecuciones/ej-1",
      }),
    });

    render(<RevisarCliente {...baseProps} />);
    fireEvent.click(screen.getByTestId("guardar-ejecutar-btn"));

    await waitFor(() => {
      const [, init] = mockFetch.mock.calls[0]!;
      expect(JSON.parse(init.body)).toEqual({ script: undefined, ejecutar: true });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/ejecuciones/ej-1");
    });
  });

  it("si falla encolar la ejecución, muestra el aviso y NO navega", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        casoPruebaId: "caso-1",
        redirectTo: "/casos/caso-1",
        ejecucionError: "YA_EXISTE_EJECUCION_EN_CURSO",
      }),
    });

    render(<RevisarCliente {...baseProps} />);
    fireEvent.click(screen.getByTestId("guardar-ejecutar-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("revisar-error").textContent).toContain(
        "YA_EXISTE_EJECUCION_EN_CURSO",
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
    // El caso sí quedó guardado — el botón cambia a "Ver caso guardado".
    expect(screen.getByTestId("ver-caso-btn")).toHaveAttribute(
      "href",
      "/casos/caso-1",
    );
  });

  it("muestra el error del server cuando el guardado falla del todo", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "La sesión ya está en estado 'guardada'" }),
    });

    render(<RevisarCliente {...baseProps} />);
    fireEvent.click(screen.getByTestId("guardar-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("revisar-error").textContent).toContain(
        "ya está en estado",
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cuando el caso ya fue guardado, muestra 'Ver caso guardado' en vez de los botones de guardar", () => {
    render(<RevisarCliente {...baseProps} casoPruebaId="caso-1" />);
    expect(screen.getByTestId("ver-caso-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("guardar-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardar-ejecutar-btn")).not.toBeInTheDocument();
  });

  it("Copiar copia el contenido actual del editor al portapapeles", async () => {
    render(<RevisarCliente {...baseProps} />);
    fireEvent.click(screen.getByTestId("copy-spec-btn"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseProps.specCode);
    });
  });

  it("avisa cuando el grabador no emitió ningún código", () => {
    render(<RevisarCliente {...baseProps} specCode={null} />);
    expect(screen.getByTestId("sin-spec-aviso")).toBeInTheDocument();
    expect(screen.getByTestId("guardar-btn")).toBeDisabled();
    expect(screen.getByTestId("guardar-ejecutar-btn")).toBeDisabled();
  });

  it("avisa cuando el spec trae un selector genérico tipo locator('div').first()", async () => {
    const specConSelectorFragil =
      baseProps.specCode.slice(0, -3) +
      "  await page.locator('div').first().click();\n});";
    render(<RevisarCliente {...baseProps} specCode={specConSelectorFragil} />);

    expect(screen.getByTestId("selectores-fragiles-aviso")).toBeInTheDocument();
    expect(screen.getByTestId("selector-fragil-item").textContent).toContain(
      "page.locator('div').first().click();",
    );
  });

  it("no muestra el aviso de selectores frágiles cuando el spec usa selectores robustos", () => {
    render(<RevisarCliente {...baseProps} />);
    expect(
      screen.queryByTestId("selectores-fragiles-aviso"),
    ).not.toBeInTheDocument();
  });

  it("el aviso de selectores frágiles se recalcula al editar el código", async () => {
    render(<RevisarCliente {...baseProps} />);
    const editor = await screen.findByTestId("monaco-editor-mock");

    fireEvent.change(editor, {
      target: {
        value: baseProps.specCode.replace(
          "});",
          "  await page.locator('span').nth(1).click();\n});",
        ),
      },
    });

    expect(screen.getByTestId("selectores-fragiles-aviso")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("descartar-cambios-btn"));

    expect(
      screen.queryByTestId("selectores-fragiles-aviso"),
    ).not.toBeInTheDocument();
  });
});
