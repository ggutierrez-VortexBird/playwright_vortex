/** Configuración compartida de Monaco para specs de Playwright; ignora TS2307/TS2792 porque Monaco no resuelve `@playwright/test`. */
export function ignorePlaywrightModuleDiagnostics(monaco: {
  languages: {
    typescript: {
      typescriptDefaults: {
        setDiagnosticsOptions: (options: { diagnosticCodesToIgnore: number[] }) => void;
      };
    };
  };
}): void {
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    // 2307/2792: módulo no encontrado
    diagnosticCodesToIgnore: [2307, 2792],
  });
}

export const VORTEST_DARK_THEME = "vortest-dark";

/** Tema oscuro de paleta sólida: keywords violeta, strings verde, números naranja, comentarios gris azulado. */
interface MonacoLike {
  languages: {
    typescript: {
      typescriptDefaults: {
        setDiagnosticsOptions: (options: { diagnosticCodesToIgnore: number[] }) => void;
      };
    };
  };
  editor: {
    defineTheme: (name: string, data: Record<string, unknown>) => void;
  };
}

export function configureVortestEditor(monaco: MonacoLike): void {
  ignorePlaywrightModuleDiagnostics(monaco);
  monaco.editor.defineTheme(VORTEST_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "34d399" },
      { token: "number", foreground: "fb923c" },
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "identifier", foreground: "cbd5e1" },
      { token: "delimiter", foreground: "94a3b8" },
      { token: "type", foreground: "38bdf8" },
    ],
    colors: {
      "editor.background": "#0f172a",
      "editor.foreground": "#cbd5e1",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#cbd5e1",
      "editorCursor.foreground": "#60a5fa",
      "editor.selectionBackground": "#334155",
    },
  });
}
