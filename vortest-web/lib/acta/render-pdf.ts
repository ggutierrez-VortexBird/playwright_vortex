// Renderiza el HTML del acta a PDF A4 con Chromium headless de Playwright; la función es testeable con un mock.

import type { ActaTemplateInput } from "./types";

export interface RenderPdfOptions {
  /** Directorio donde se guarda el PDF (por defecto storage/actas/). */
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

/** Siguiente consecutivo anual, atómico (upsert con increment) para evitar carreras. */
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

/** Firma del render; testeable con un mock de Playwright (por defecto chromium). */
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

/** Renderiza el HTML del acta a un PDF en disco; Playwright es inyectable. */
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
      try {
        fs.writeFileSync(pdfPath, pdfBuffer)
      } catch (err) {
        throw new Error(
          `No se pudo escribir el PDF del acta en "${pdfPath}": ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        )
      }
      return { pdfPath, consecutivo }
    } finally {
      await page.close().catch(() => undefined)
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
}