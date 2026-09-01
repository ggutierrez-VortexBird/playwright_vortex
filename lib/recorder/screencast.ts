/**
 * Wrapper de CDP `Page.startScreencast` para el recorder-worker.
 *
 * Lanza el screencast JPEG con la config del design (q80, everyNthFrame:1)
 * y reenvía cada `Page.screencastFrame` event al callback `onFrame`.
 * Acuse de recibo: tras cada frame, enviamos `Page.screencastFrameAck` con
 * el sessionID para que CDP siga mandando frames.
 *
 * IMPORTANTE: este módulo no se mockea en unit tests (CDP requiere browser
 * real). Se cubre con test de integración 4.7 (lifecycle del worker).
 */
import type { CDPSession, Page } from "playwright";

export interface ScreencastConfig {
  format: "jpeg" | "png";
  quality: number;
  everyNthFrame: number;
}

export const DEFAULT_SCREENCAST_CONFIG: ScreencastConfig = {
  format: "jpeg",
  quality: 80,
  everyNthFrame: 1,
};

export interface ScreencastHandle {
  stop: () => Promise<void>;
}

/**
 * Inicia el screencast en la page dada. Cada frame JPEG se pasa como
 * base64 a `onFrame(data, ts)` donde data es el string base64 y ts es
 * `Date.now()` cuando se recibe el evento en el worker.
 *
 * Retorna un objeto `ScreencastHandle` cuyo método `stop()` apaga el screencast.
 */
export async function startScreencast(
  page: Page,
  onFrame: (data: string, ts: number) => void,
  config: ScreencastConfig = DEFAULT_SCREENCAST_CONFIG,
): Promise<ScreencastHandle> {
  const cdp: CDPSession = await page.context().newCDPSession(page);

  const frameHandler = (params: { data: string; sessionId: number; metadata?: object }) => {
    onFrame(params.data, Date.now());
    // Ack para que CDP siga mandando frames
    cdp
      .send("Page.screencastFrameAck", { sessionId: params.sessionId })
      .catch(() => {
        // si la sesión ya está cerrada, ignorar
      });
  };

  cdp.on("Page.screencastFrame", frameHandler);

  await cdp.send("Page.startScreencast", {
    format: config.format,
    quality: config.quality,
    everyNthFrame: config.everyNthFrame,
  });

  return {
    async stop() {
      try {
        cdp.off("Page.screencastFrame", frameHandler);
        await cdp.send("Page.stopScreencast").catch(() => undefined);
        await cdp.detach().catch(() => undefined);
      } catch {
        // ignore cleanup errors
      }
    },
  };
}