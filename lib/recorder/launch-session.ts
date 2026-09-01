/**
 * Lanza Chromium persistente para una sesión de grabación.
 *
 *   - chromium.launchPersistentContext({ headless: true, args: [...] })
 *   - carga storageState si se pasa
 *   - context.exposeFunction('__pw_report', onReport) — puente browser→Node
 *   - context.addInitScript con listeners DOM (HU-G3)
 *   - goto URL con timeout 10s; si falla, lanza error específico para que
 *     la sesión quede estado='error' con mensajeError claro.
 *
 * HU-G3: el init-script registra listeners de click/input/change/keydown/submit
 * en captura (fase `true`) y llama a `window.__pw_report(payload)` con un
 * payload que el caller (recorder-worker) persiste vía `persistirPaso`.
 *
 * NO se mockea en unit tests (requiere browser real). Se cubre con
 * test de integración 4.7 (lifecycle del worker).
 */
import { chromium } from "playwright";
import type { BrowserContext, CDPSession, Page } from "playwright";
import { INIT_SCRIPT } from "@/lib/grabador/init-script";
import type { EventoDom } from "@/lib/grabador/translator";

export interface LaunchSessionInput {
  sessionId: string;
  urlInicial: string;
  storageState?: unknown;
  /** Handler invocado cada vez que el browser reporta un evento DOM.
   *  El recorder-worker lo wirea a persistirPaso + broadcast + auto-wait. */
  onReport?: (evento: EventoDom) => void | Promise<void>;
}

export interface LaunchSessionResult {
  context: BrowserContext;
  page: Page;
  cdp: CDPSession;
}

export class UrlInaccesibleError extends Error {
  constructor(public readonly url: string, public readonly cause: unknown) {
    super(`No se pudo acceder a ${url}`);
    this.name = "UrlInaccesibleError";
  }
}

const GOTO_TIMEOUT_MS = 10_000;

/**
 * Lanza el browser y navega a urlInicial.
 *
 * Lanza `UrlInaccesibleError` si page.goto falla por timeout, DNS, cert
 * inválido, etc. El caller mapea este error a SesionGrabacion.estado='error'
 * con mensajeError=<reason>.
 */
export async function launchSession(input: LaunchSessionInput): Promise<LaunchSessionResult> {
  // userDataDir vacío en memoria: cada sesión tiene su propio context
  // (no compartimos storage entre sesiones)
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    ...(input.storageState ? { storageState: input.storageState as Parameters<typeof chromium.launchPersistentContext>[1] extends infer O ? O extends { storageState?: infer S } ? S : never : never } : {}),
    viewport: { width: 1280, height: 720 },
  });

  // HU-G3: el browser-side init-script llama a window.__pw_report(payload)
  // por cada evento DOM. Acá exponemos esa función hacia Node y la conectamos
  // al handler del caller (recorder-worker.ts). Si no hay handler, noop.
  await context.exposeFunction(
    "__pw_report",
    async (evento: EventoDom) => {
      if (input.onReport) {
        await input.onReport(evento);
      }
    },
  );

  // HU-G3: inyecta los listeners de captura (click/input/change/keydown/submit)
  // ANTES de que el browser ejecute cualquier script del usuario.
  await context.addInitScript({ content: INIT_SCRIPT });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(input.urlInicial, { timeout: GOTO_TIMEOUT_MS, waitUntil: "domcontentloaded" });
  } catch (err: unknown) {
    // Cleanup el context antes de propagar el error
    try {
      await context.close();
    } catch {
      // ignore
    }
    throw new UrlInaccesibleError(input.urlInicial, err);
  }

  const cdp = await context.newCDPSession(page);

  return { context, page, cdp };
}