// Lanza el proceso hijo `scripts/codegen-runner.ts` que graba el `.spec.ts`; la ruta de salida, el archivo semilla y el handle no cambian.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/** Espera máxima a que el runner avise que el navegador abrió. */
const READY_TIMEOUT_MS = 45_000;
/** Margen entre la parada ordenada y la terminación forzada. */
const GRACEFUL_STOP_MS = 3_000;

export interface CodegenHandle {
  /** Ruta absoluta al .spec.ts que escribe el runner. */
  specPath: string;
  /** PID del subprocess (undefined si ya cerró o no spawneó). */
  pid?: number;
  /** Pide parada ordenada y, si hace falta, termina el proceso. */
  kill(): Promise<void>;
  /** Indica si sigue vivo. */
  isAlive(): boolean;
}

export interface SpawnCodegenResult extends CodegenHandle {
  /** Resuelve con el exit code cuando el subprocess termina. */
  exitCode(): Promise<number | null>;
  /** Resuelve `true` si el runner avisó que abrió el navegador, `false` si el proceso murió o se agotó la espera. */
  ready(): Promise<boolean>;
}

/** Convierte un string a un componente apto para filesystem (basta cortar a 8 chars, son UUID). */
function shortSessionTag(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "anon";
}

/** Ruta absoluta del .spec.ts de la sesión: en `dirHint` (con mkdir -p) si se pasa, si no en el tempdir del SO. */
export function resolveSpecPath(sessionId: string, dirHint?: string): string {
  const tag = shortSessionTag(sessionId);
  // 4 bytes aleatorios para que sesiones del mismo usuario no pisen el mismo archivo
  const nonce = randomBytes(4).toString("hex");
  const fileName = `grabador-${tag}-${nonce}.spec.ts`;
  if (dirHint) {
    const absDir = isAbsolute(dirHint) ? dirHint : join(process.cwd(), dirHint);
    mkdirSync(absDir, { recursive: true });
    return join(absDir, fileName);
  }
  return join(tmpdir(), fileName);
}

/** Ruta del runner (los workers arrancan desde la raíz del proyecto); `RECORDER_RUNNER_PATH` permite otra en pruebas. */
export function resolveRunnerPath(): string {
  const override = process.env.RECORDER_RUNNER_PATH;
  if (override) {
    return isAbsolute(override) ? override : resolve(process.cwd(), override);
  }
  return resolve(process.cwd(), "scripts", "codegen-runner.ts");
}

export interface SpawnCodegenOptions {
  /** URL a la que navega el runner al abrir el navegador. */
  urlInicial: string;
  /** Navegador (chromium/firefox/webkit); por defecto "chromium". */
  navegador?: "chromium" | "firefox" | "webkit";
  /** Directorio donde se escribe el .spec.ts (por defecto el tempdir del SO). */
  specDir?: string;
  /** StorageState de Playwright para iniciar el contexto autenticado. */
  storageState?: unknown;
  /** Crea el spec vacío si no existe antes de empezar (por defecto true). */
  seedSpecFile?: boolean;
  /** Entorno adicional para el proceso hijo (por defecto process.env). */
  env?: NodeJS.ProcessEnv;
  /** Si se pasa, se invoca este binario en vez del runner (solo pruebas). */
  overrideBin?: string;
}

/** Lanza el runner de grabación; queda vivo hasta que el usuario cierre el navegador o se llame `kill()`. */
export function spawnCodegen(
  sessionId: string,
  options: SpawnCodegenOptions,
): SpawnCodegenResult {
  const specPath = resolveSpecPath(sessionId, options.specDir);
  mkdirSync(dirname(specPath), { recursive: true });

  if (options.seedSpecFile !== false) {
    // Archivo semilla como baseline para el watcher; el runner lo sobreescribe al arrancar
    try {
      writeFileSync(
        specPath,
        `// Playwright codegen is recording to this file.\n// File path: ${specPath}\n`,
        "utf8",
      );
    } catch {
      // Si falla (permisos, etc.) se sigue; el watcher detecta el archivo cuando el runner lo cree
    }
  }


  const navegador = options.navegador ?? "chromium";
  let storageStatePath: string | undefined;

  const cleanupStorageState = () => {
    if (storageStatePath) {
      try {
        rmSync(storageStatePath, { force: true });
      } catch {
        // ignorar
      }
      storageStatePath = undefined;
    }
  };

  if (options.storageState) {
    const tag = shortSessionTag(sessionId);
    storageStatePath = join(dirname(specPath), `storage-${tag}-${randomBytes(4).toString("hex")}.json`);
    writeFileSync(storageStatePath, JSON.stringify(options.storageState, null, 2), "utf8");
  }

  const runnerArgs = [
    "--session",
    sessionId,
    "--url",
    options.urlInicial,
    "--browser",
    navegador,
    "--out",
    specPath,
    ...(storageStatePath ? ["--storage-state", storageStatePath] : []),
  ];

  // `node --import tsx <runner>`, igual que scripts/recorder-worker.ts
  const bin = options.overrideBin ?? process.execPath;
  const args =
    options.overrideBin !== undefined
      ? runnerArgs
      : ["--import", "tsx", resolveRunnerPath(), ...runnerArgs];

  const proc: ChildProcess = spawn(bin, args, {
    // stdin abierto para la parada ordenada, stdout para eventos del runner, stderr heredado para el log
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

  // El runner emite una línea JSON por evento; solo importa `ready`, el resto se registra
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
        if (proc.exitCode !== null) {
          // El proceso ya había terminado solo antes de kill(); sin este cleanup el storage-state temporal quedaba huérfano
          cleanupStorageState();
          return resolvePromise();
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(forceTimer);
          resolvePromise();
        };

        // Parada ordenada por stdin: en Windows las señales matan el proceso sin ejecutar sus manejadores
        try {
          proc.stdin?.write("stop\n");
        } catch {
          // stdin ya cerrado: se cae al camino de la señal
        }

        const forceTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            try {
              proc.kill("SIGTERM");
            } catch {
              // ignorar
            }
            setTimeout(() => {
              if (proc.exitCode === null) {
                try {
                  proc.kill("SIGKILL");
                } catch {
                  // ignorar
                }
              }
              cleanupStorageState();
              finish();
            }, 1_000).unref?.();
            return;
          }
          cleanupStorageState();
          finish();
        }, GRACEFUL_STOP_MS);
        forceTimer.unref?.();

        proc.once("exit", () => {
          cleanupStorageState();
          finish();
        });
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
