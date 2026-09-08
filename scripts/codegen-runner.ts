/**
 * codegen-runner.ts — proceso hijo que graba un `.spec.ts` con el grabador
 * de Playwright SIN abrir la ventana del Playwright Inspector.
 *
 * Reemplaza al `npx playwright codegen --output=<spec> <url>` que se
 * spawneaba antes. El binario siempre abre el Inspector y no expone
 * bandera para desactivarlo, así que se lo ocultaba a posteriori desde el
 * sistema operativo (PowerShell + ShowWindow), con parpadeo visible y sin
 * garantía de éxito.
 *
 * La variable `PW_CODEGEN_NO_INSPECTOR` NO sirve para esto: en Playwright
 * 1.62.1 corta `RecorderApp.show()` ANTES de crear el grabador
 * (coreBundle.js:50848), así que apaga la grabación entera, no solo la
 * ventana.
 *
 * ── `recorderMode: "api"` vs `"default"` (HALLAZGO — 2026-09-08) ──────────
 *
 * La primera versión de este runner usaba `context._enableRecorder({
 * recorderMode: "api", ... }, eventSink)`: no abre ninguna ventana
 * (`ProgrammaticRecorderApp`, coreBundle.js:50997) y entrega cada acción
 * ya convertida en código vía callbacks. Funcionaba, PERO en sitios donde
 * el propio JS de la página reacciona al `mousedown` antes de que termine
 * el gesto de click (típico en autocompletes de e-commerce que navegan de
 * inmediato al elegir una sugerencia), el modo "api" pierde la carrera
 * contra esa navegación y el selector cae a un genérico tipo
 * `page.locator('div').first()` en vez de uno robusto por rol o texto.
 *
 * Se confirmó en pruebas controladas (mismo click, misma página, mismo
 * mecanismo `_enableRecorder`, solo cambiando `recorderMode`):
 *   - "api":     0 de 6+ corridas generaron el selector correcto.
 *   - "default": 4 de 4 corridas generaron `getByRole('option', {...})`.
 *
 * Por qué: `Recorder._install()` (coreBundle.js:34222) pasa `recorderMode`
 * al script que se INYECTA dentro de la página grabada
 * (`extendInjectedScript(source, { recorderMode, ... })`). Ese script —no
 * el consumidor Node-side— es el que escucha los eventos DOM reales y
 * decide el selector; su comportamiento cambia según el modo. El
 * consumidor (`ProgrammaticRecorderApp` vs `RecorderApp`) solo recibe la
 * acción YA resuelta — no es la causa de la diferencia.
 *
 * `"default"` es el modo que usa el binario `codegen` real, así que este
 * runner ahora lo usa también: le pasamos `outputFile` (el mismo mecanismo
 * de `--output`) y dejamos que el propio Playwright escriba el `.spec.ts`
 * completo (envoltorio incluido) con su `ThrottledFile` interno (mismo
 * throttle de 250ms que replicábamos a mano). Esto además corrige una
 * fidelidad menor: el envoltorio real incluye `test.use({ deviceScaleFactor:
 * 1 })` cuando se pasa ese contextOption, algo que la versión anterior
 * (envoltorio armado a mano en `spec-builder.ts`) no reproducía.
 *
 * El problema es que `"default"` sí abre una ventana — no la del Inspector
 * en sí (esa la seguimos evitando), sino un browser COMPAÑERO 600x600 que
 * hospeda su UI (`_RecorderApp._show()`, coreBundle.js:50876). La variable
 * `PWTEST_CLI_HEADLESS=1` hace que ESE browser compañero nazca headless
 * (coreBundle.js:50882) — sin parpadeo, sin hack de SO, porque nunca llega
 * a crear una ventana visible. El browser grabado (el que ve el usuario)
 * es otro proceso completamente aparte y sigue `headed` como siempre.
 *
 * Verificado también: cerrar el browser grabado (`browser.close()`, o el
 * usuario cerrando la ventana) deja la ÚLTIMA acción ya escrita en
 * `outputFile` — el cierre de contexto dispara el flush interno del
 * `ThrottledFile` de Playwright antes de que la promesa de cierre resuelva.
 *
 * Uso:
 *   node --import tsx scripts/codegen-runner.ts \
 *     --session <id> --url <urlInicial> --browser chromium --out <specPath>
 *
 * Protocolo con el proceso padre:
 *   - stdout: una línea JSON por evento (`ready`, `goto_failed`, `stopped`).
 *   - stdin:  la línea `stop` pide apagado ordenado (cerrar + salir).
 *             En Windows las señales matan el proceso sin ejecutar los
 *             manejadores, por eso la parada ordenada no depende de ellas.
 *   - salida 0: la grabación terminó bien, sea por `stop` o porque el
 *             usuario cerró la ventana del navegador.
 */

// Tiene que fijarse ANTES de _enableRecorder (que es quien, internamente,
// lanza el browser compañero del Inspector). No pisa un valor que el
// proceso padre ya haya fijado explícitamente.
if (!process.env.PWTEST_CLI_HEADLESS) {
  process.env.PWTEST_CLI_HEADLESS = "1";
}

import { chromium, firefox, webkit } from "@playwright/test";
import type { Browser, BrowserContext, BrowserType } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { renderSpec } from "../lib/recorder/spec-builder";

type NavegadorId = "chromium" | "firefox" | "webkit";

const ENGINES: Record<NavegadorId, BrowserType> = { chromium, firefox, webkit };

interface RunnerArgs {
  sessionId: string;
  url: string;
  navegador: NavegadorId;
  outPath: string;
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

  return { sessionId, url, outPath, navegador: navegadorRaw };
}

function isNavegadorId(value: string): value is NavegadorId {
  return value === "chromium" || value === "firefox" || value === "webkit";
}

/**
 * Activa el grabador en modo "default" (el mismo que usa `codegen`) sin
 * ventana de Inspector visible: `PWTEST_CLI_HEADLESS=1` (fijado al tope
 * del módulo) hace que su browser compañero nazca headless.
 *
 * Falla ruidosamente si la API interna no está: es preferible no arrancar
 * a dejar un navegador abierto que no graba nada. El mensaje nombra la
 * versión de Playwright encontrada para que el diagnóstico sea inmediato
 * tras una actualización.
 */
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
    const pkg = require("playwright-core/package.json") as { version?: string };
    return pkg.version ?? "desconocida";
  } catch {
    return "desconocida";
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  mkdirSync(dirname(args.outPath), { recursive: true });
  // Envoltorio vacío en disco desde el arranque: el vigilante del
  // recorder-worker muestra el panel de pasos aunque todavía no haya
  // acciones. En cuanto llegue la primera (el `navigate` del goto inicial),
  // el ThrottledFile interno de Playwright lo pisa con el contenido real.
  writeFileSync(args.outPath, renderSpec([]), "utf8");

  const engine = ENGINES[args.navegador];
  const launchOptions = { headless: false };
  const contextOptions = { deviceScaleFactor: 1 };

  const browser: Browser = await engine.launch({
    ...launchOptions,
    handleSIGINT: false,
  });
  const context = (await browser.newContext(
    contextOptions,
  )) as ContextWithRecorder;

  await enableRecorder(context, args.outPath, launchOptions, contextOptions);

  let shuttingDown = false;
  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    emit({ type: "stopped", reason });
    try {
      await browser.close();
    } catch {
      // El navegador puede haberse cerrado solo; no es un error.
    }
    process.exit(exitCode);
  };

  // El usuario cerró la ventana del navegador. Es la señal principal de
  // "terminé de grabar" del flujo, junto con el botón Detener. Para cuando
  // este evento llega, el cierre del contexto ya disparó el flush final
  // del .spec.ts (verificado empíricamente: el contenido está en disco
  // antes de que la propia promesa de cierre resuelva).
  browser.on("disconnected", () => {
    if (!shuttingDown) {
      shuttingDown = true;
      emit({ type: "stopped", reason: "browser_closed" });
      process.exit(0);
    }
  });

  // Cerrar la última pestaña equivale a cerrar el navegador, igual que en
  // el binario (`launchContext`, coreBundle.js:69536).
  context.on("page", (page) => {
    page.on("close", () => {
      const quedanPaginas = browser
        .contexts()
        .some((ctx) => ctx.pages().length > 0);
      if (!quedanPaginas) void shutdown("last_page_closed");
    });
  });

  // Parada ordenada pedida por el padre.
  createInterface({ input: process.stdin }).on("line", (line) => {
    if (line.trim() === "stop") void shutdown("user_stop");
  });
  process.on("SIGTERM", () => void shutdown("sigterm"));
  process.on("SIGINT", () => void shutdown("sigint"));

  const page = context.pages()[0] ?? (await context.newPage());

  emit({ type: "ready", sessionId: args.sessionId, specPath: args.outPath });

  // La navegación inicial se graba como acción `navigate` porque el
  // grabador ya está escuchando: es la que produce la primera línea
  // `await page.goto(...)`, idéntica a la del binario.
  try {
    await page.goto(args.url);
  } catch (err) {
    // URL inalcanzable: el usuario ve la página de error en el navegador y
    // puede escribir otra dirección. Matar la sesión acá sería peor.
    emit({
      type: "goto_failed",
      url: args.url,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// Solo corre cuando se ejecuta como script; importarlo desde los tests no
// lanza ningún navegador.
if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(
      `[codegen-runner] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
