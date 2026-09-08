/**
 * codegen-watcher.ts — chokidar.watch sobre el .spec.ts que escribe
 * `npx playwright codegen`.
 *
 * Pivot V2 (ACTA-Plan-Pivot-Playwright-Codegen): el QA interactua con
 * Chromium abierto por Playwright. Cada acción que dispara el inspector
 * (click, fill, hover, alt+click assertion, snapshot) result en que
 * Playwright codegen EMITE una línea al .spec.ts. Eso es lo que el
 * usuario quiere: el script EXACTO de Playwright, sin decoración.
 *
 * Esta pieza vigila el archivo y emite `{content, version, changedAt}`
 * cada vez que cambia. El caller (recorder-worker) persiste y hace
 * broadcast WS a los clientes conectados.
 *
 * Política:
 *   - chokidar hace debounce pequeño (50ms) — Playwright escribe en
 *     rafagas (varias líneas por click, ej. click en custom widget).
 *   - El primer `add` se ignora (es nuestro seed vacío, no algo del QA).
 *   - Si el archivo se borra (Playwright lo recrea), watcher re-observe.
 *   - onError loggea y NO mata el watcher — archivos transitorios en
 *     Windows pueden dar EPERM un instante y re-estabilizarse.
 */

import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface SpecUpdateEvent {
  /** Path absoluto del .spec.ts. */
  path: string;
  /** Contenido completo del archivo en el momento del cambio. */
  content: string;
  /** Bytes (size) — útil para evitar re-procesar el mismo contenido. */
  bytes: number;
  /** ISO8601 timestamp del evento. */
  changedAt: string;
}

export interface CodegenWatcherOptions {
  /** Path absoluto del .spec.ts. */
  specPath: string;
  /** Handler invocado en cada cambio. */
  onUpdate: (event: SpecUpdateEvent) => void;
  /** Handler invocado si la sesión muere (ej. el archivo fue borrado
   *  y no reapareció en 5s). Llamado una sola vez. */
  onGone?: () => void;
  /** Debounce en ms. Default 50ms. */
  debounceMs?: number;
}

/**
 * Vigila `specPath` y emite `onUpdate` cuando cambia.
 * Retorna una función `close()` que detiene la vigilancia.
 *
 * Implementación: usa `fs.watch` (más rápido que chokidar y no requiere
 * deps). chokidar lo teníamos como dep transitiva pero si no lo
 * necesitamos para esto, evitamos el overhead. Si el archivo NO existe
 * todavía, hace poll cada 200ms hasta que aparezca.
 */
export function watchCodegenSpec(
  options: CodegenWatcherOptions,
): { close: () => void; isActive: () => boolean } {
  const debounceMs = options.debounceMs ?? 50;
  let active = true;
  let watcher: FSWatcher | null = null;
  let missingPollTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEmittedBytes = -1;

  const emitNow = async () => {
    try {
      const [content, st] = await Promise.all([
        readFile(options.specPath, "utf8"),
        stat(options.specPath),
      ]);
      if (st.size === lastEmittedBytes) return;
      lastEmittedBytes = st.size;
      options.onUpdate({
        path: options.specPath,
        content,
        bytes: st.size,
        changedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.error(
        `[codegen-watcher] failed reading ${options.specPath}:`,
        err,
      );
    }
  };

  const scheduleEmit = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void emitNow();
    }, debounceMs);
  };

  const startWatch = () => {
    if (!active) return;
    if (missingPollTimer) {
      clearInterval(missingPollTimer);
      missingPollTimer = null;
    }
    if (!existsSync(options.specPath)) return;
    try {
      watcher = watch(options.specPath, { persistent: false }, () => {
        scheduleEmit();
      });
      watcher.on("error", (err) => {
        console.error(
          `[codegen-watcher] fs.watch error on ${options.specPath}:`,
          err,
        );
      });
      watcher.on("close", () => {
        watcher = null;
        if (active) pollUntilSpecAppears();
      });
      // Emitir el contenido inicial cuando recién apareció
      void emitNow();
    } catch (err) {
      console.error(`[codegen-watcher] watch() failed:`, err);
    }
  };

  const pollUntilSpecAppears = () => {
    if (missingPollTimer) return;
    missingPollTimer = setInterval(() => {
      const handle = missingPollTimer;
      if (!active) {
        if (handle) clearInterval(handle);
        missingPollTimer = null;
        return;
      }
      if (existsSync(options.specPath)) {
        startWatch();
      }
    }, 200);
  };

  if (existsSync(options.specPath)) startWatch();
  else pollUntilSpecAppears();

  return {
    close: () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (missingPollTimer) clearInterval(missingPollTimer);
      if (watcher) {
        try {
          watcher.close();
        } catch {}
        watcher = null;
      }
    },
    isActive: () => active,
  };
}
