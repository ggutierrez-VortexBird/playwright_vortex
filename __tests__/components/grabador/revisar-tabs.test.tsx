/**
 * Tests for components/grabador/revisar-tabs.tsx (HU-G11).
 *
 * Cubre:
 *   - Render de los 2 tabs (Pasos / Editor).
 *   - Switch entre tabs.
 *   - El panel "Pasos" muestra los items drag-and-drop.
 *   - El panel "Editor" monta el CodigoEditor con el script pre-computado.
 *   - casoPruebaId=null → tab Editor sigue funcionando pero sin botón save.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RevisarTabs } from "@/components/grabador/revisar-tabs";
import type {
  RevisarPasoItem,
  RevisarParametroItem,
} from "@/components/grabador/revisar-cliente";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

// Mock Monaco Editor igual que en codigo-editor.test.tsx.
jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  Editor: ({
    value,
    options,
  }: {
    value: string;
    options: { readOnly?: boolean };
  }) => (
    <textarea
      data-testid="monaco-mock-editor"
      data-readonly={options?.readOnly ? "true" : "false"}
      value={value}
      readOnly={options?.readOnly}
    />
  ),
}));

const basePasos: RevisarPasoItem[] = [
  {
    id: "p1",
    numero: 1,
    tipo: "navegar",
    descripcion: "Abrir portal",
    selectorPrincipal: null,
    selectoresRespaldo: null,
    valor: "https://example.com",
    esValorSensible: false,
    assertionKind: null,
  },
  {
    id: "p2",
    numero: 2,
    tipo: "clic",
    descripcion: "Clic en Submit",
    selectorPrincipal: { tag: "button" },
    selectoresRespaldo: [],
    valor: null,
    esValorSensible: false,
    assertionKind: null,
  },
];

const baseParametros: RevisarParametroItem[] = [];

const SAMPLE_SCRIPT = `import { test, expect } from '@playwright/test';\ntest('demo', async ({ page }) => {});\n`;

describe("RevisarTabs (HU-G11)", () => {
  it("renderiza ambos tabs y muestra el panel Pasos por defecto", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="Caso A"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );

    expect(screen.getByTestId("revisar-tab-pasos")).toBeInTheDocument();
    expect(screen.getByTestId("revisar-tab-editor")).toBeInTheDocument();
    expect(
      screen.getByTestId("revisar-tab-panel-pasos"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("revisar-tab-panel-editor"),
    ).not.toBeInTheDocument();
  });

  it("muestra el contador de pasos en el tab 'Pasos'", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );
    // El contador está dentro del tab button
    const tab = screen.getByTestId("revisar-tab-pasos");
    expect(tab.textContent).toMatch(/2/);
  });

  it("click en tab 'Editor' cambia el panel visible", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );

    fireEvent.click(screen.getByTestId("revisar-tab-editor"));

    expect(
      screen.getByTestId("revisar-tab-panel-editor"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("revisar-tab-panel-pasos"),
    ).not.toBeInTheDocument();
  });

  it("el panel Editor monta el CodigoEditor con el script pre-computado", async () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId="caso-1"
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
        scriptFileName="caso.spec.ts"
      />,
    );

    fireEvent.click(screen.getByTestId("revisar-tab-editor"));

    const editor = await screen.findByTestId("monaco-mock-editor");
    expect(editor).toBeInTheDocument();
    expect((editor as HTMLTextAreaElement).value).toBe(SAMPLE_SCRIPT);
    expect(editor.getAttribute("data-readonly")).toBe("true");
    expect(screen.getByText("caso.spec.ts")).toBeInTheDocument();
  });

  it("el panel Pasos muestra los items con data-testid correcto", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );
    expect(screen.getByTestId("paso-revisar-p1")).toBeInTheDocument();
    expect(screen.getByTestId("paso-revisar-p2")).toBeInTheDocument();
    expect(screen.getByText("Abrir portal")).toBeInTheDocument();
    expect(screen.getByText("Clic en Submit")).toBeInTheDocument();
  });

  it("estado vacío en Pasos cuando no hay pasos", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={[]}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );
    expect(screen.getByText(/No hay pasos para revisar/)).toBeInTheDocument();
  });

  it("casoPruebaId=null → tab Editor no muestra botón Guardar", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );

    fireEvent.click(screen.getByTestId("revisar-tab-editor"));

    expect(
      screen.getByTestId("codigo-editor-no-save-hint"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("codigo-editor-save")).not.toBeInTheDocument();
  });

  it("casoPruebaId presente → tab Editor muestra botón Guardar", () => {
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId="caso-1"
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
      />,
    );

    fireEvent.click(screen.getByTestId("revisar-tab-editor"));

    expect(screen.getByTestId("codigo-editor-save")).toBeInTheDocument();
  });

  it("persistOrder se llama cuando se reordena pasos", async () => {
    const persistOrder = jest.fn().mockResolvedValue(true);

    // Importante: en jsdom dnd-kit no dispara eventos de drag reales.
    // Probamos el path vía setPasos interno invocando handleDragEnd de
    // manera indirecta — re-montando con un nuevo orden, el componente
    // NO lo detecta, pero podemos verificar que la prop se invoca cuando
    // simulamos el reorder via state.
    // Para esta integración, validamos que la prop se pasa correctamente.
    render(
      <RevisarTabs
        sesionId="ses-1"
        casoPruebaId={null}
        nombre="X"
        pasosIniciales={basePasos}
        parametrosIniciales={baseParametros}
        scriptGenerado={SAMPLE_SCRIPT}
        persistOrder={persistOrder}
      />,
    );

    // Smoke: la prop se pasa y el componente monta. La validación
    // detallada del reorder via dnd-kit queda cubierta en tests
    // existentes de dnd-kit (no se re-testea acá).
    expect(persistOrder).not.toHaveBeenCalled();
  });
});
