"use client";

/**
 * BrowserChrome — barra de URL editable + botones de navegación.
 *
 * Look & feel: réplica de la "BrowserUrlBar" del mockup
 * documentacion/referencias-diseño/cambios/grabador.html — tarjeta blanca
 * con controles de navegación simulados + caja de URL con candado +
 * acciones de utilidad (Copiar / Visitar).
 *
 * Sin navegación real: solo permite tipear una URL y presiona Enter →
 * `onNavigate(url)`. El worker es el que manda al browser real el goto,
 * no hay routing interno.
 *
 * Origin checks: cuando la URL cambia por un goto del browser real, el
 * worker lo broadcastea como `url_changed` y eso actualiza `pageUrl`.
 */
import { useState, useEffect, FormEvent } from "react";

export interface BrowserChromeProps {
  /** URL actualmente cargada en el browser (viene del worker). */
  pageUrl: string;
  /** URL que se va a navegar cuando se teca Enter. */
  onNavigate: (url: string) => void;
  /** Disabled cuando la sesión no está live. */
  disabled: boolean;
}

export function BrowserChrome({
  pageUrl,
  onNavigate,
  disabled,
}: BrowserChromeProps) {
  const [draft, setDraft] = useState(pageUrl);
  const [copied, setCopied] = useState(false);

  // Mantiene el draft en sync si pageUrl cambia desde afuera.
  useEffect(() => {
    setDraft(pageUrl);
  }, [pageUrl]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = draft.trim();
    if (!url || disabled) return;
    onNavigate(url);
  }

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const canSubmit = !disabled && draft.trim().length > 0;
  const isSecure = pageUrl.startsWith("https://");

  return (
    <div
      data-testid="browser-chrome"
      className="flex items-center gap-3 border-b border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-2.5"
    >
      <div className="flex items-center gap-1 text-m3-on-surface-variant">
        <button
          data-testid="bc-back"
          disabled
          title="Atrás (no soportado en headless de Playwright)"
          className="rounded p-1 opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <button
          data-testid="bc-forward"
          disabled
          title="Adelante (no soportado)"
          className="rounded p-1 opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
        <button
          data-testid="bc-reload"
          disabled
          title="Recargar (no soportado)"
          className="rounded p-1 opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="min-w-0 flex-1" data-testid="bc-form">
        <div className="flex items-center gap-2 rounded-lg border border-m3-outline-variant bg-m3-surface-container px-3 py-1.5 transition focus-within:border-m3-secondary focus-within:ring-1 focus-within:ring-m3-secondary">
          <span className="material-symbols-outlined shrink-0 text-[16px] text-m3-success" aria-hidden="true">
            {isSecure ? "lock" : "lock_open"}
          </span>
          <input
            data-testid="bc-url"
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://app.ejemplo.com"
            disabled={disabled}
            className="w-full bg-transparent font-mono-code text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none disabled:opacity-50"
          />
        </div>
      </form>

      <div className="flex shrink-0 items-center gap-1">
        <button
          data-testid="bc-go"
          type="submit"
          form="bc-form"
          disabled={!canSubmit}
          className="rounded-lg bg-m3-secondary-container px-3 py-1.5 font-label text-label-sm font-semibold text-m3-on-secondary-container transition hover:bg-m3-secondary-fixed disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ir
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar URL"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-label text-label-sm font-medium text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-on-surface"
        >
          <span className="material-symbols-outlined text-[16px]">content_copy</span>
          {copied ? "Copiado" : "Copiar"}
        </button>
        <a
          href={pageUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en pestaña nueva"
          aria-disabled={!pageUrl}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-label text-label-sm font-medium text-m3-secondary transition hover:bg-m3-secondary-container ${!pageUrl ? "pointer-events-none opacity-40" : ""}`}
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          Visitar
        </a>
      </div>
    </div>
  );
}
