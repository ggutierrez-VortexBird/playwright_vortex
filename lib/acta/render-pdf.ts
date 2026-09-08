/**
 * HU-G19 — Renderizado de HTML → PDF para el acta de evidencia.
 *
 * Reusa Playwright (Chromium) ya instalado como dependencia del proyecto.
 * Lanza una instancia headless efímera, navega a `about:blank`, escribe
 * el HTML con `page.setContent`, y exporta a PDF A4.
 *
 * Diseño: la función `renderHtmlToPdf` es pura y testeable con un mock
 * de Playwright (`playwrightMock` opcional). En producción se usa
 * `chromium.launch()`.
 *
 * IMPORTANTE: este módulo se invoca desde la ruta Next.js
 * `/api/ejecuciones/[id]/acta`. Como Next.js corre en Node, podemos usar
 * Playwright directamente. Si en el futuro queremos aislarlo (p.ej. en
 * un worker), basta con envolver la llamada en una queue.
 */

import type { ActaTemplateInput } from "./types";

export interface RenderPdfOptions {
  /** Output directory donde se persiste el PDF. Default: storage/actas/ */
  outputDir?: string
}

export interface RenderPdfResult {
  /** Path absoluto al PDF generado. */
  pdfPath: string
  /** Consecutivo del acta (formato ACE-AAAA-NNNN). */
  consecutivo: string
}

export interface ActaConsecutivoInput {
  /** Año actual (4 dígitos). */
  anio: number
  /** Próximo correlativo (1-based dentro del año). */
  correlativo: number
}

/**
 * Calcula el siguiente consecutivo anual de forma atómica.
 * Usa `upsert` con `update: { ultimo: { increment: 1 } }` para que
 * PostgreSQL genere un valor único sin race conditions.
 */
export async function nextActaConsecutivo(
  prismaClient: unknown,
): Promise<{ anio: number; correlativo: number; consecutivo: string }> {
  const prisma = prismaClient as {
    consecutivoAnual: {
      upsert: (args: unknown) => Promise<{ anio: number; ultimo: number }>
    }
  }
  const anio = new Date().getFullYear()
  const row = await prisma.consecutivoAnual.upsert({
    where: { anio },
    update: { ultimo: { increment: 1 } },
    create: { anio, ultimo: 1 },
  })
  const consecutivo = `ACE-${row.anio}-${String(row.ultimo).padStart(4, "0")}`
  return { anio: row.anio, correlativo: row.ultimo, consecutivo }
}

/**
 * Firma de la función de render — testeable pasando un mock de Playwright.
 * Por defecto usa chromium de `playwright`.
 */
export type ChromiumLike = {
  launch: (opts: Record<string, unknown>) => Promise<{
    newPage: () => Promise<{
      setContent: (html: string, opts?: { waitUntil?: string }) => Promise<void>
      pdf: (opts: Record<string, unknown>) => Promise<Buffer>
      close: () => Promise<void>
    }>
    close: () => Promise<void>
  }>
}

/**
 * Renderiza el acta HTML a un PDF en disco.
 *
 * @param input           Datos para la plantilla del acta.
 * @param consecutivo     Consecutivo del acta (previamente calculado).
 * @param templateHtml    HTML producido por `renderActaHTML(input)`.
 * @param options         Output dir override.
 * @param playwright      Inyección de Playwright (default: `playwright`).
 */
export async function renderActaToPdf(args: {
  templateHtml: string
  consecutivo: string
  outputDir?: string
  playwright?: { chromium: ChromiumLike }
}): Promise<RenderPdfResult> {
  const { templateHtml, consecutivo, outputDir } = args
  const playwrightMod = args.playwright ?? (await import("playwright"))
  const browser = await playwrightMod.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  })
  try {
    const page = await browser.newPage()
    try {
      await page.setContent(templateHtml, { waitUntil: "load" })
      const path = (await import("node:path")).default
      const fs = (await import("node:fs")).default
      const finalDir = outputDir ?? path.resolve(process.cwd(), "storage", "actas")
      fs.mkdirSync(finalDir, { recursive: true })
      const pdfPath = path.join(finalDir, `${consecutivo}.pdf`)
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
      })
      fs.writeFileSync(pdfPath, pdfBuffer)
      return { pdfPath, consecutivo }
    } finally {
      await page.close().catch(() => undefined)
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
}