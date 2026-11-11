// Vigila el .spec.ts de `playwright codegen` y emite {content, version, changedAt} en cada cambio; onError no mata el watcher (EPERM transitorio en Windows).

import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface SpecUpdateEvent {
  /** Ruta absoluta del .spec.ts. */
  path: string;
  /** Contenido completo del archivo al momento del cambio. */
  content: string;
  /** Tamaño en bytes; sirve para no reprocesar el mismo contenido. */
  bytes: number;
  /** Marca de tiempo ISO8601 del evento. */
  changedAt: string;
}

export interface CodegenWatcherOptions {
  /** Ruta absoluta del .spec.ts. */
  specPath: string;
  /** Handler invocado en cada cambio. */
  onUpdate: (event: SpecUpdateEvent) => void;
  /** Se invoca una sola vez si la sesión muere (ej. el archivo se borró y no reapareció en 5s). */
  onGone?: () => void;
  /** Debounce en ms (por defecto 50). */
  debounceMs?: number;
}

/** Vigila `specPath` con `fs.watch` y emite `onUpdate`; si el archivo no existe aún, reintenta cada 200ms. Devuelve `close()`. */
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
