import {
  ignorePlaywrightModuleDiagnostics,
  configureVortestEditor,
  VORTEST_DARK_THEME,
} from "@/lib/recorder/monaco-setup";

describe("lib/recorder/monaco-setup", () => {
  describe("ignorePlaywrightModuleDiagnostics", () => {
    it("llama a setDiagnosticsOptions con códigos 2307 y 2792", () => {
      const setDiagnosticsOptions = jest.fn();
      const monaco = {
        languages: {
          typescript: {
            typescriptDefaults: { setDiagnosticsOptions },
          },
        },
      };

      ignorePlaywrightModuleDiagnostics(monaco as any);

      expect(setDiagnosticsOptions).toHaveBeenCalledWith({
        diagnosticCodesToIgnore: [2307, 2792],
      });
    });

    it("2307 = Cannot find module", () => {
      // Documenta los códigos que silenciamos.
      expect([2307, 2792]).toContain(2307);
    });

    it("2792 = Cannot find module (moduleResolution hint)", () => {
      expect([2307, 2792]).toContain(2792);
    });
  });

  describe("configureVortestEditor", () => {
    it("define el tema oscuro vortest", () => {
      const defineTheme = jest.fn();
      const monaco: any = {
        languages: {
          typescript: {
            typescriptDefaults: { setDiagnosticsOptions: jest.fn() },
          },
        },
        editor: { defineTheme },
      };

      configureVortestEditor(monaco);

      expect(defineTheme).toHaveBeenCalledWith(
        VORTEST_DARK_THEME,
        expect.objectContaining({
          base: "vs-dark",
          inherit: true,
          rules: expect.any(Array),
          colors: expect.objectContaining({
            "editor.background": "#0f172a",
          }),
        }),
      );
    });

    it("también llama a ignorePlaywrightModuleDiagnostics", () => {
      const setDiagnosticsOptions = jest.fn();
      const defineTheme = jest.fn();
      const monaco: any = {
        languages: {
          typescript: {
            typescriptDefaults: { setDiagnosticsOptions },
          },
        },
        editor: { defineTheme },
      };

      configureVortestEditor(monaco);

      expect(setDiagnosticsOptions).toHaveBeenCalled();
      expect(defineTheme).toHaveBeenCalled();
    });
  });

  describe("VORTEST_DARK_THEME", () => {
    it("es un string identificador del tema", () => {
      expect(typeof VORTEST_DARK_THEME).toBe("string");
      expect(VORTEST_DARK_THEME.length).toBeGreaterThan(0);
    });
  });
});
