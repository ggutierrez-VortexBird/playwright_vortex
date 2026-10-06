/**
 * Configuración compartida del Monaco Editor para editar specs de
 * Playwright (.spec.ts). Monaco corre su propio TS language service en el
 * browser sin acceso al `node_modules` real, así que nunca puede resolver
 * `import { test, expect } from '@playwright/test'` — sin este ajuste
 * marca esa línea con TS2307/TS2792 ("Cannot find module...") aunque el
 * script sea válido. Se ignoran esos códigos puntuales; el resto de la
 * validación de TypeScript (sintaxis, tipos locales, etc.) sigue activa.
 */
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
    // 2307: Cannot find module 'x' or its corresponding type declarations.
    // 2792: Cannot find module 'x'. Did you mean to set moduleResolution...
    diagnosticCodesToIgnore: [2307, 2792],
  });
}

export const VORTEST_DARK_THEME = "vortest-dark";

/**
 * Tema oscuro con la misma paleta sólida (sin degradados) que
 * documentacion/referencias-diseño/cambios/editor-codigo.html: keywords en
 * violeta, strings en verde, números en naranja, comentarios en gris azulado.
 */
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
