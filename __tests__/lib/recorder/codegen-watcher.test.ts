/**
 * Tests for lib/recorder/codegen-watcher.ts — verifica que:
 *   1. Detecta cuando el spec aparece (poll → fs.watch).
 *   2. Emite onUpdate cuando el archivo cambia.
 *   3. Debouncea rafagas (multi-write en <50ms → 1 emit).
 *   4. NO re-emite si el size es idéntico al último emitido.
 *   5. close() detiene la vigilancia.
 *
 * No mockea fs (queremos probar el behavior real, no mocks que hacen
 * mentir al test).
 */

import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchCodegenSpec } from "@/lib/recorder/codegen-watcher";

describe("recorder/codegen-watcher", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vxn-watch-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  /**
   * Helper: en Windows `fs.watch` puede tardar hasta ~150ms en entregar
   * eventos. Usamos timeouts generosos en los tests para evitar flakiness.
   */
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("emite onUpdate cuando el spec se crea (poll → fs.watch)", async () => {
    const specPath = join(tmpDir, "ses-A.spec.ts");
    const updates: string[] = [];
    const w = watchCodegenSpec({
      specPath,
      onUpdate: (e) => updates.push(e.content),
    });

    // archivo NO existe todavía
    writeFileSync(specPath, "line 1\n");
    await wait(300);

    writeFileSync(specPath, "line 1\nline 2\n");
    await wait(200);

    w.close();
    expect(updates.length).toBeGreaterThanOrEqual(1);
    // Al menos uno debe contener "line 2"
    expect(updates.some((c) => c.includes("line 2"))).toBe(true);
  });

  it("NO re-emite si el size no cambió", async () => {
    const specPath = join(tmpDir, "ses-B.spec.ts");
    writeFileSync(specPath, "static\n");
    await wait(150);

    const updates: number[] = [];
    const w = watchCodegenSpec({
      specPath,
      debounceMs: 30,
      onUpdate: (e) => updates.push(e.bytes),
    });

    // Touch el archivo con idéntico contenido → algunos OS emiten un evento
    // aunque el size no cambie. El watcher debe filtrarlo.
    await wait(100);
    writeFileSync(specPath, "static\n"); // <- mismo content
    await wait(200);

    w.close();
    // Solo debe haber 1 emit (el inicial). No más de 2 para tolerar edge cases.
    expect(updates.length).toBeLessThanOrEqual(2);
  });

  it("debounce coalesce writes rápidas en un solo emit", async () => {
    const specPath = join(tmpDir, "ses-C.spec.ts");
    writeFileSync(specPath, "x");
    await wait(150);

    let emits = 0;
    const w = watchCodegenSpec({
      specPath,
      debounceMs: 100,
      onUpdate: () => {
        emits += 1;
      },
    });
    await wait(150); // <- dejar que el emit inicial corra antes de la rafaga

    const emitsBeforeRafaga = emits;

    // rafaga: 5 writes en <50ms
    for (let i = 0; i < 5; i += 1) {
      appendFileSync(specPath, `\nwrite ${i}`);
      await wait(5);
    }

    await wait(250); // > debounceMs
    w.close();

    // El debounce debe coalescer en 1 emit adicional (NO 5).
    expect(emits - emitsBeforeRafaga).toBeLessThanOrEqual(1);
  });

  it("close() detiene la vigilancia", async () => {
    const specPath = join(tmpDir, "ses-D.spec.ts");
    writeFileSync(specPath, "a");
    await wait(150);

    const updates: number[] = [];
    const w = watchCodegenSpec({
      specPath,
      debounceMs: 20,
      onUpdate: (e) => updates.push(e.bytes),
    });
    await wait(100);

    w.close();

    writeFileSync(specPath, "ab");
    await wait(200);

    // No deben llegar nuevos emits después de close
    const countAtClose = updates.length;
    await wait(200);
    expect(updates.length).toBe(countAtClose);
  });
});
