/**
 * Lanza Chromium persistente para una sesión de grabación.
 *
 *   - chromium.launchPersistentContext({ headless: true, args: [...] })
 *   - carga storageState si se pasa
 *   - page.exposeFunction('__pw_report', () => {}) — listener stub para G3
 *   - page.addInitScript con listeners DOM stub (cableado en HU-G3)
 *   - goto URL con timeout 10s; si falla, lanza error específico para que
 *     la sesión quede estado='error' con mensajeError claro.
 *
 * NO se mockea en unit tests (requiere browser real). Se cubre con
 * test de integración 4.7 (lifecycle del worker).
 */
import { chromium } from "playwright";
import type { BrowserContext, CDPSession, Page } from "playwright";

export interface LaunchSessionInput {
  sessionId: string;
  urlInicial: string;
  storageState?: unknown;
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

  // Listener stub — G3 lo cablea al traductor de pasos
  await context.exposeFunction("__pw_report", () => {
    // noop en G1
  });

  // addInitScript con listeners DOM stub (HU-G3 los conecta)
  await context.addInitScript(() => {
    // marca de que el init script corrió (debugging)
    (window as unknown as { __pw_init_ran?: boolean }).__pw_init_ran = true;
  });

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