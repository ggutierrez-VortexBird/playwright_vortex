// Visor de trazas de Playwright servido desde la propia app: trace.playwright.dev es otro sitio y no recibe la cookie de sesión (SameSite=Strict) que exige /api/artefactos.
import { readFile, stat } from 'fs/promises'
import * as path from 'path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const RAIZ = path.join(process.cwd(), 'node_modules', 'playwright-core', 'lib', 'vite', 'traceViewer')

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
}

export async function GET(_request: Request, { params }: { params: Promise<{ ruta?: string[] }> }) {
  const { ruta = [] } = await params
  const archivo = path.resolve(RAIZ, ...(ruta.length > 0 ? ruta : ['index.html']))
  if (!archivo.startsWith(RAIZ + path.sep)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  try {
    if (!(await stat(archivo)).isFile()) throw new Error('no es archivo')
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return new NextResponse(new Uint8Array(await readFile(archivo)), {
    headers: {
      'Content-Type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
