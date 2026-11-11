// Proceso hijo que graba un `.spec.ts` con el grabador de Playwright (`recorderMode: "default"`, como `codegen`) sin ventana de Inspector visible. Uso: --session <id> --url <url> --browser chromium --out <specPath>; stdout emite JSON por evento, la línea `stop` por stdin cierra ordenado.

// Se fija antes de _enableRecorder; no pisa un valor ya fijado por el proceso padre
if (!process.env.PWTEST_CLI_HEADLESS) {
  process.env.PWTEST_CLI_HEADLESS = "1";
}

import { chromium, firefox, webkit } from "@playwright/test";
import type { Browser, BrowserContext, BrowserType } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { renderSpec } from "../lib/recorder/spec-builder";
import { createRequire } from "node:module"

type NavegadorId = "chromium" | "firefox" | "webkit";

const ENGINES: Record<NavegadorId, BrowserType> = { chromium, firefox, webkit };

interface RunnerArgs {
  sessionId: string;
  url: string;
  navegador: NavegadorId;
  outPath: string;
  storageState?: string;
}

interface EnableRecorderParams {
  language?: string;
  mode?: "inspecting" | "recording";
  recorderMode?: "default" | "api";
  outputFile?: string;
  launchOptions?: Record<string, unknown>;
  contextOptions?: Record<string, unknown>;
  handleSIGINT?: boolean;
}

type ContextWithRecorder = BrowserContext & {
  _enableRecorder?: (params: EnableRecorderParams) => Promise<void>;
};

function emit(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

export function parseArgs(argv: readonly string[]): RunnerArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else {
      values.set(arg.slice(2), argv[i + 1] ?? "");
      i += 1;
    }
  }

  const sessionId = values.get("session") ?? "";
  const url = values.get("url") ?? "";
  const outPath = values.get("out") ?? "";
  const navegadorRaw = values.get("browser") ?? "chromium";
  const storageState = values.get("storage-state");

  const faltantes = [
    !sessionId && "--session",
    !url && "--url",
    !outPath && "--out",
  ].filter(Boolean);
  if (faltantes.length > 0) {
    throw new Error(`Argumentos requeridos ausentes: ${faltantes.join(", ")}`);
  }
  if (!isNavegadorId(navegadorRaw)) {
    throw new Error(
      `--browser inválido: "${navegadorRaw}". Valores válidos: chromium, firefox, webkit.`,
    );
  }

  return { sessionId, url, outPath, navegador: navegadorRaw, storageState };
}

function isNavegadorId(value: string): value is NavegadorId {
  return value === "chromium" || value === "firefox" || value === "webkit";
}

/** Activa el grabador en modo "default" (el de `codegen`) con `PWTEST_CLI_HEADLESS=1` para que su browser compañero nazca headless; falla si la API interna no está. */
export async function enableRecorder(
  context: ContextWithRecorder,
  outputFile: string,
  launchOptions: Record<string, unknown> = {},
  contextOptions: Record<string, unknown> = {},
): Promise<void> {
  if (typeof context._enableRecorder !== "function") {
    throw new Error(
      `Esta versión de Playwright (${resolvePlaywrightVersion()}) no expone ` +
        `BrowserContext._enableRecorder. El modo grabador depende de esa API ` +
        `interna; fijá playwright-core en 1.62.1 o adaptá scripts/codegen-runner.ts.`,
    );
  }
  await context._enableRecorder({
    language: "playwright-test",
    mode: "recording",
    recorderMode: "default",
    outputFile,
    launchOptions,
    contextOptions,
    handleSIGINT: false,
  });
}

function resolvePlaywrightVersion(): string {
  try {
    const pkg = createRequire(`${process.cwd()}/`)("playwright-core/package.json") as { version?: string };
    return pkg.version ?? "desconocida";
  } catch {
    return "desconocida";
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  mkdirSync(dirname(args.outPath), { recursive: true });
  // Envoltorio vacío en disco desde el arranque, para que el panel de pasos aparezca; Playwright lo pisa con el contenido real
  writeFileSync(args.outPath, renderSpec([]), "utf8");

  const engine = ENGINES[args.navegador];
  const launchOptions = { headless: false };
  const contextOptions: import("@playwright/test").BrowserContextOptions = {
    deviceScaleFactor: 1,
    // Mismo idioma y zona que el motor (vortest-engine/playwright.config.ts): sin esto Firefox graba en en-US y WebKit en es-MX, y los textos que codegen copia a los selectores no coinciden al ejecutar.
    locale: process.env.PLAYWRIGHT_LOCALE || "es-CO",
    timezoneId: process.env.PLAYWRIGHT_TIMEZONE || "America/Bogota",
    ...(args.storageState ? { storageState: args.storageState } : {}),
  };

  const browser: Browser = await engine.launch({
    ...launchOptions,
    handleSIGINT: false,
  });
  const context = (await browser.newContext(
    contextOptions,
  )) as ContextWithRecorder;

  await enableRecorder(
    context,
    args.outPath,
    launchOptions as Record<string, unknown>,
    contextOptions as Record<string, unknown>,
  );

  let shuttingDown = false;
  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    emit({ type: "stopped", reason });
    try {
      await browser.close();
    } catch {
      // El navegador puede haberse cerrado solo; no es un error
    }
    process.exit(exitCode);
  };

  // El usuario cerró el navegador; el cierre del contexto ya hizo el flush final del .spec.ts a disco
  browser.on("disconnected", () => {
    if (!shuttingDown) {
      shuttingDown = true;
      emit({ type: "stopped", reason: "browser_closed" });
      process.exit(0);
    }
  });

  // Cerrar la última pestaña equivale a cerrar el navegador, igual que el binario
  context.on("page", (page) => {
    page.on("close", () => {
      const quedanPaginas = browser
        .contexts()
        .some((ctx) => ctx.pages().length > 0);
      if (!quedanPaginas) void shutdown("last_page_closed");
    });
  });

  // Parada ordenada pedida por el padre
  createInterface({ input: process.stdin }).on("line", (line) => {
    if (line.trim() === "stop") void shutdown("user_stop");
  });
  process.on("SIGTERM", () => void shutdown("sigterm"));
  process.on("SIGINT", () => void shutdown("sigint"));

  const page = context.pages()[0] ?? (await context.newPage());

  emit({ type: "ready", sessionId: args.sessionId, specPath: args.outPath });

  // La navegación inicial se graba como `navigate` porque el grabador ya escucha; produce el primer `await page.goto(...)`
  try {
    await page.goto(args.url);
  } catch (err) {
    // URL inalcanzable: el usuario ve la página de error y puede escribir otra; matar la sesión sería peor
    emit({
      type: "goto_failed",
      url: args.url,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// Solo corre como script; importarlo desde los tests no lanza ningún navegador
if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(
      `[codegen-runner] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
