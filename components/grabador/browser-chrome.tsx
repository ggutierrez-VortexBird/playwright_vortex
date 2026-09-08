"use client";

/**
 * BrowserChrome — barra de URL editable + botones de navegación.
 *
 * Material 3 — chrome del navegador (look-and-feel idéntico a la barra
 * de Chrome/Firefox para que el QA se sienta "en casa").
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

  const canSubmit = !disabled && draft.trim().length > 0;

  return (
    <div
      data-testid="browser-chrome"
      className="flex items-center gap-2 border-b border-m3-outline-variant bg-m3-surface-container-low px-3 py-2"
    >
      <button
        data-testid="bc-back"
        disabled
        title="Atrás (no soportado en headless de Playwright)"
        className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high disabled:opacity-40 transition"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      </button>
      <button
        data-testid="bc-forward"
        disabled
        title="Adelante (no soportado)"
        className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high disabled:opacity-40 transition"
      >
        <span className="material-symbols-outlined text-[20px]">
          arrow_forward
        </span>
      </button>
      <button
        data-testid="bc-reload"
        disabled
        title="Recargar (no soportado)"
        className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high disabled:opacity-40 transition"
      >
        <span className="material-symbols-outlined text-[20px]">refresh</span>
      </button>
      <form
        onSubmit={handleSubmit}
        className="flex-1"
        data-testid="bc-form"
      >
        <input
          data-testid="bc-url"
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://app.ejemplo.com"
          disabled={disabled}
          className="w-full rounded-full bg-m3-surface-container-highest px-4 py-1 font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none focus:ring-1 focus:ring-m3-secondary disabled:opacity-50 transition"
        />
      </form>
      <button
        data-testid="bc-go"
        type="submit"
        form="bc-form"
        disabled={!canSubmit}
        className="rounded bg-m3-secondary-container px-3 py-1 font-headline text-label-md text-m3-on-secondary-container hover:bg-m3-secondary-fixed disabled:opacity-50 transition"
        onClick={() => {
          /* submit lo maneja el form */
        }}
      >
        Ir
      </button>
    </div>
  );
}
