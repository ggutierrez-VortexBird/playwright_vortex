// __tests__/lib/worker/script-temp.test.ts
// Motor Fase 1: script-temp.ts ya no escribe a disco (eso se movió a
// vortest-engine/src/execution/script-writer.ts) — solo sobrevive el
// templating de texto que arma `ExecuteJobMessage.scriptText`.

import { buildScriptText } from "@/lib/worker/script-temp";

describe("buildScriptText", () => {
  it("agrega el hook afterEach de storageState al final del script", () => {
    const script = 'import { test } from "@playwright/test"; test("pasa", async () => {});';

    const result = buildScriptText(script);

    expect(result.startsWith(script)).toBe(true);
    expect(result).toContain("__vortexTest.afterEach");
    expect(result).toContain("PLAYWRIGHT_STORAGE_STATE_OUTPUT");
  });

  it("no muta el string original", () => {
    const script = "const x = 1;";
    const result = buildScriptText(script);
    expect(script).toBe("const x = 1;");
    expect(result).not.toBe(script);
  });
});
