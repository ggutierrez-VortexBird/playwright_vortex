/**
 * codegen-subprocess.ts — lanza el proceso hijo que graba el `.spec.ts`.
 *
 * Antes spawneaba `npx playwright codegen --output=<spec> <url>`. Ese
 * binario abre SIEMPRE la ventana del Playwright Inspector y no tiene
 * bandera para desactivarla, así que había que ocultarla a posteriori
 * desde el sistema operativo (`hide-inspector.ts`, ya eliminado), con
 * parpadeo visible y sin garantía de éxito.
 *
 * Ahora spawnea `scripts/codegen-runner.ts`, que activa el MISMO grabador
 * de Playwright en modo programático: no crea ninguna ventana de Inspector
 * y escribe el mismo `.spec.ts`. Ver la cabecera del runner para el detalle
 * de la API interna que usa.
 *
 * Lo que NO cambia, porque el resto de la cadena depende de ello:
 *   - la ruta y el nombre del archivo de salida (`resolveSpecPath`),
 *   - el archivo semilla,
 *   - la forma del handle que se devuelve,
 *   - el contenido del `.spec.ts`, que sigue siendo exactamente el que
 *     produce codegen (política ZERO modificación).
 *
 * Salida esperada del archivo (probado con playwright@1.62.1):
 *
 *     import { test, expect } from '@playwright/test';
 *
 *     test('test', async ({ page }) => {
 *       await page.goto('https://x');
 *       await page.getByRole('button', { name: 'Login' }).click();
 *     });
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/** Espera máxima a que el runner avise que el navegador abrió. */
const READY_TIMEOUT_MS = 45_000;
/** Margen entre la parada ordenada y la terminación forzada. */
const GRACEFUL_STOP_MS = 3_000;

export interface CodegenHandle {
  /** Path absoluto al .spec.ts que escribe el runner. */
  specPath: string;
  /** PID del subprocess (undefined si ya cerró o no spawneó). */
  pid?: number;
  /** Pide parada ordenada y, si hace falta, termina el proceso. */
  kill(): Promise<void>;
  /** ¿Sigue vivo? */
  isAlive(): boolean;
}

export interface SpawnCodegenResult extends CodegenHandle {
  /** Resuelve cuando el subprocess termina. Retorna exit code. */
  exitCode(): Promise<number | null>;
  /**
   * Resuelve `true` cuando el runner avisó que el navegador abrió, y
   * `false` si el proceso murió antes o se agotó la espera. Permite
   * distinguir "arrancó" de "falló al arrancar" sin adivinar.
   */
  ready(): Promise<boolean>;
}

/**
 * Convierte cualquier string a un component apto para filesystem
 * (sin caracteres raros). Como Playwright nos da UUID, basta cortar a 8 chars.
 */
function shortSessionTag(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "anon";
}

/**
 * Resuelve la ruta del .spec.ts para esta sesión.
 *
 * - dirHint: si se pasa (ej. directorio dedicado del proyecto), úsalo
 *   mkdir-p incluido. Si no, usa OS tempdir.
 * - Devuelve SIEMPRE ruta absoluta.
 */
export function resolveSpecPath(sessionId: string, dirHint?: string): string {
  const tag = shortSessionTag(sessionId);
  // 4 bytes random para que múltiples sesiones del mismo usuario
  // no pisen el mismo archivo si Playwright tiene bug de concurrencia.
  const nonce = randomBytes(4).toString("hex");
  const fileName = `grabador-${tag}-${nonce}.spec.ts`;
  if (dirHint) {
    const absDir = isAbsolute(dirHint) ? dirHint : join(process.cwd(), dirHint);
    mkdirSync(absDir, { recursive: true });
    return join(absDir, fileName);
  }
  return join(tmpdir(), fileName);
}

/**
 * Ruta del runner. Los workers arrancan desde la raíz del proyecto (ver
 * los scripts de `package.json`), igual que el resto de `lib/worker`.
 * `RECORDER_RUNNER_PATH` permite apuntar a otro archivo en pruebas.
 */
export function resolveRunnerPath(): string {
  const override = process.env.RECORDER_RUNNER_PATH;
  if (override) {
    return isAbsolute(override) ? override : resolve(process.cwd(), override);
  }
  return resolve(process.cwd(), "scripts", "codegen-runner.ts");
}

export interface SpawnCodegenOptions {
  /** URL a la que navega el runner cuando abre el navegador. */
  urlInicial: string;
  /** Navegador (chromium/firefox/webkit). Default "chromium". */
  navegador?: "chromium" | "firefox" | "webkit";
  /** Directorio donde se escribe el .spec.ts. Default OS tempdir. */
  specDir?: string;
  /** Si el spec file NO existe, ¿lo creamos vacío antes? Útil cuando el
   *  QA cancela antes de cualquier interacción — el runner no habría
   *  escrito nada y nuestro watcher lo ignora. Default true. */
  seedSpecFile?: boolean;
  /** Entorno adicional para el child process. Default process.env. */
  env?: NodeJS.ProcessEnv;
  /** Si se pasa, no usar el runner — invocar este binario directamente
   *  (solo pruebas: evita abrir un navegador real). */
  overrideBin?: string;
}

/**
 * Spawn del runner de grabación. El subprocess queda vivo hasta que el
 * usuario cierre la ventana del navegador o hasta que llamemos `kill()`.
 */
export function spawnCodegen(
  sessionId: string,
  options: SpawnCodegenOptions,
): SpawnCodegenResult {
  const specPath = resolveSpecPath(sessionId, options.specDir);
  mkdirSync(dirname(specPath), { recursive: true });

  if (options.seedSpecFile !== false) {
    // Archivo semilla para que el watcher tenga un baseline desde el cual
    // medir diffs. El runner lo sobreescribe con el envoltorio real apenas
    // arranca.
    try {
      writeFileSync(
        specPath,
        `// Playwright codegen is recording to this file.\n// File path: ${specPath}\n`,
        "utf8",
      );
    } catch {
      // Si falla (permisos, etc.), seguimos — el watcher igual detecta
      // el archivo cuando el runner lo cree.
    }
  }

  const navegador = options.navegador ?? "chromium";

  const runnerArgs = [
    "--session",
    sessionId,
    "--url",
    options.urlInicial,
    "--browser",
    navegador,
    "--out",
    specPath,
  ];

  // `node --import tsx <runner>` es la misma forma en que arrancan
  // `scripts/worker.ts` y `scripts/recorder-worker.ts`.
  const bin = options.overrideBin ?? process.execPath;
  const args =
    options.overrideBin !== undefined
      ? runnerArgs
      : ["--import", "tsx", resolveRunnerPath(), ...runnerArgs];

  const proc: ChildProcess = spawn(bin, args, {
    // stdin abierto para la parada ordenada; stdout para los eventos del
    // runner; stderr heredado para que los errores se vean en el log del
    // worker.
    stdio: ["pipe", "pipe", "inherit"],
    detached: false,
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    windowsHide: false,
  });

  proc.on("error", (err) => {
    console.error(
      `[codegen-subprocess] failed to spawn ${bin} ${args.join(" ")}: ${err}`,
    );
  });

  let readyResolved = false;
  let resolveReady: (value: boolean) => void = () => {};
  const readyPromise = new Promise<boolean>((r) => {
    resolveReady = (value: boolean) => {
      if (readyResolved) return;
      readyResolved = true;
      r(value);
    };
  });

  const readyTimer = setTimeout(() => resolveReady(false), READY_TIMEOUT_MS);
  readyTimer.unref?.();

  // El runner emite una línea JSON por evento. Solo nos interesa `ready`;
  // el resto se registra para diagnóstico.
  let stdoutBuffer = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");
    let nl = stdoutBuffer.indexOf("\n");
    while (nl !== -1) {
      const line = stdoutBuffer.slice(0, nl).trim();
      stdoutBuffer = stdoutBuffer.slice(nl + 1);
      nl = stdoutBuffer.indexOf("\n");
      if (!line) continue;
      try {
        const event = JSON.parse(line) as { type?: string };
        if (event.type === "ready") {
          clearTimeout(readyTimer);
          resolveReady(true);
        } else {
          console.log(`[codegen-runner:${shortSessionTag(sessionId)}] ${line}`);
        }
      } catch {
        console.log(`[codegen-runner:${shortSessionTag(sessionId)}] ${line}`);
      }
    }
  });

  proc.once("exit", () => {
    clearTimeout(readyTimer);
    resolveReady(false);
  });

  let stopping = false;

  const handle: SpawnCodegenResult = {
    specPath,
    pid: proc.pid,
    isAlive: () => proc.exitCode === null && !proc.killed && !stopping,
    kill: () =>
      new Promise<void>((resolvePromise) => {
        if (stopping) return resolvePromise();
        stopping = true;
        if (proc.exitCode !== null) return resolvePromise();

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(forceTimer);
          resolvePromise();
        };

        // Parada ordenada por stdin. En Windows las señales terminan el
        // proceso sin ejecutar sus manejadores, así que el volcado final
        // del runner no puede depender de ellas.
        try {
          proc.stdin?.write("stop\n");
        } catch {
          // stdin ya cerrado — se cae al camino de la señal.
        }

        const forceTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            try {
              proc.kill("SIGTERM");
            } catch {
              // ignore
            }
            setTimeout(() => {
              if (proc.exitCode === null) {
                try {
                  proc.kill("SIGKILL");
                } catch {
                  // ignore
                }
              }
              finish();
            }, 1_000).unref?.();
            return;
          }
          finish();
        }, GRACEFUL_STOP_MS);
        forceTimer.unref?.();

        proc.once("exit", finish);
      }),
    exitCode: () =>
      new Promise((resolvePromise) => {
        if (proc.exitCode !== null) return resolvePromise(proc.exitCode);
        proc.once("exit", (code) => resolvePromise(code));
      }),
    ready: () => readyPromise,
  };

  return handle;
}
