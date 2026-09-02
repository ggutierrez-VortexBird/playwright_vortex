/**
 * Tests for components/grabador/codigo-editor.tsx (HU-G11).
 *
 * El editor de Monaco se carga via `next/dynamic({ ssr: false })`. En
 * jsdom no tenemos Monaco; mockeamos el módulo `@monaco-editor/react`
 * para verificar el contrato del wrapper sin renderizar el editor real.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CodigoEditor } from "@/components/grabador/codigo-editor";

const mockOnChange = jest.fn();
const mockOnMount = jest.fn();

jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  Editor: ({
    value,
    onChange,
    onMount,
    options,
    "data-testid": testId,
  }: {
    value: string;
    onChange: (v: string) => void;
    onMount: (e: unknown) => void;
    options: { readOnly?: boolean };
    "data-testid"?: string;
  }) => {
    mockOnChange.mockImplementation(onChange);
    mockOnMount.mockImplementation(onMount);
    return (
      <textarea
        data-testid={testId ?? "monaco-mock-editor"}
        data-readonly={options?.readOnly ? "true" : "false"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    json: async () => ({}),
  });
});

describe("CodigoEditor (HU-G11)", () => {
  const SAMPLE = `import { test, expect } from '@playwright/test';\ntest('demo', async ({ page }) => {});\n`;

  it("renderiza el script inicial en un editor (read-only por defecto)", async () => {
    render(
      <CodigoEditor
        scriptInicial={SAMPLE}
        casoPruebaId="caso-1"
        scriptFileName="demo.spec.ts"
      />,
    );
    // El Editor se carga async via useEffect, esperamos a que aparezca
    const editor = await screen.findByTestId("monaco-mock-editor");
    expect(editor).toBeInTheDocument();
    expect((editor as HTMLTextAreaElement).value).toBe(SAMPLE);
    expect(editor.getAttribute("data-readonly")).toBe("true");
  });

  it("muestra el nombre del archivo en el toolbar", () => {
    render(
      <CodigoEditor
        scriptInicial={SAMPLE}
        casoPruebaId="caso-1"
        scriptFileName="login.spec.ts"
      />,
    );
    expect(screen.getByText("login.spec.ts")).toBeInTheDocument();
  });

  it("el toggle 'Editar' cambia el readOnly del editor", async () => {
    render(
      <CodigoEditor scriptInicial={SAMPLE} casoPruebaId="caso-1" />,
    );
    const editor = await screen.findByTestId("monaco-mock-editor");
    expect(editor.getAttribute("data-readonly")).toBe("true");

    fireEvent.click(screen.getByTestId("codigo-editor-toggle-edit"));

    expect(editor.getAttribute("data-readonly")).toBe("false");
  });

  it("'sin guardar' aparece cuando el usuario edita el script", async () => {
    render(
      <CodigoEditor scriptInicial={SAMPLE} casoPruebaId="caso-1" />,
    );

    // Esperar a que cargue Monaco
    await screen.findByTestId("monaco-mock-editor");
    // Toggle editable
    fireEvent.click(screen.getByTestId("codigo-editor-toggle-edit"));
    // Modify
    fireEvent.change(screen.getByTestId("monaco-mock-editor"), {
      target: { value: SAMPLE + "// editado\n" },
    });

    expect(screen.getByTestId("codigo-editor-dirty")).toBeInTheDocument();
  });

  it("si no hay casoPruebaId, no se muestra el botón Guardar y aparece el hint", () => {
    render(<CodigoEditor scriptInicial={SAMPLE} casoPruebaId={null} />);
    expect(screen.queryByTestId("codigo-editor-save")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("codigo-editor-no-save-hint"),
    ).toBeInTheDocument();
  });

  it("botón Guardar PUT /api/casos/[id] con FormData(scriptFile) cuando hay cambios", async () => {
    render(
      <CodigoEditor
        scriptInicial={SAMPLE}
        casoPruebaId="caso-99"
        scriptFileName="login.spec.ts"
      />,
    );

    // Esperar a que cargue Monaco
    await screen.findByTestId("monaco-mock-editor");
    // Toggle editable
    fireEvent.click(screen.getByTestId("codigo-editor-toggle-edit"));
    // Modify
    const newScript = SAMPLE + "// user edit\n";
    fireEvent.change(screen.getByTestId("monaco-mock-editor"), {
      target: { value: newScript },
    });

    const saveBtn = screen.getByTestId("codigo-editor-save");
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/casos/caso-99",
        expect.objectContaining({ method: "PUT" }),
      );
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = callArgs[1]?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    // El FormData debe contener un scriptFile
    const file = body.get("scriptFile") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("login.spec.ts");
  });

  it("muestra mensaje OK después de guardar exitosamente", async () => {
    render(
      <CodigoEditor
        scriptInicial={SAMPLE}
        casoPruebaId="caso-99"
        scriptFileName="x.spec.ts"
      />,
    );
    await screen.findByTestId("monaco-mock-editor");
    fireEvent.click(screen.getByTestId("codigo-editor-toggle-edit"));
    fireEvent.change(screen.getByTestId("monaco-mock-editor"), {
      target: { value: "EDITED" },
    });

    fireEvent.click(screen.getByTestId("codigo-editor-save"));

    await waitFor(() => {
      expect(screen.getByTestId("codigo-editor-ok")).toBeInTheDocument();
    });
  });

  it("muestra mensaje de error cuando el PUT falla", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "boom" }),
    });

    render(<CodigoEditor scriptInicial={SAMPLE} casoPruebaId="caso-99" />);
    await screen.findByTestId("monaco-mock-editor");
    fireEvent.click(screen.getByTestId("codigo-editor-toggle-edit"));
    fireEvent.change(screen.getByTestId("monaco-mock-editor"), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByTestId("codigo-editor-save"));

    await waitFor(() => {
      expect(screen.getByTestId("codigo-editor-error")).toHaveTextContent(
        "boom",
      );
    });
  });
});
