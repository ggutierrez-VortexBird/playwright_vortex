"use client";

/**
 * RecToolbar — toolbar inferior del modo grabador.
 *
 * V1 tenía Pausa / Reanudar / Señalar elemento. En esta versión el QA
 * interactúa directamente con la ventana headed de Playwright codegen,
 * que tiene su propia toolbar nativa (incluye pausa). Mantenemos solo:
 *  - Mostrar la URL actual del browser (read-only, fuente de verdad del worker)
 *  - Botón "Copiar spec" para que el QA lleve el spec a otro lado
 *  - Botón "Detener y revisar" duplicado del topbar (acceso rápido)
 *
 * Decisión basada en el plan ACTA-Plan-Browser-Headed-Real.md #4 / #5 / #7.
 */
import { useState } from "react";

export interface RecToolbarProps {
  /** URL actual del browser (vía WS). */
  currentUrl?: string;
  /** Spec actual completo (se copia tal cual). */
  specContent: string;
  /** Disabled mientras no esté live. */
  disabled: boolean;
  /** Click en Detener y revisar (alias del topbar). */
  onDetener: () => void;
}

export function RecToolbar({
  currentUrl,
  specContent,
  disabled,
  onDetener,
}: RecToolbarProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(specContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — no queremos un toast ruidoso por un fallo de clipboard
    }
  }

  return (
    <footer
      data-testid="rec-toolbar"
      className="flex items-center justify-between gap-3 border-t border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-m3-secondary">
          link
        </span>
        <span
          data-testid="rec-toolbar-url"
          className="truncate font-mono-code text-label-sm text-m3-on-surface-variant"
        >
          {currentUrl ?? "(sin URL)"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          data-testid="rec-toolbar-copy"
          onClick={handleCopy}
          disabled={disabled || specContent.length === 0}
          className="rounded px-2 py-1 font-headline text-label-sm text-m3-on-surface-variant hover:bg-m3-surface-container-high disabled:opacity-40 transition"
          aria-label="Copiar spec al portapapeles"
        >
          <span className="material-symbols-outlined mr-1 inline-block align-middle text-[18px]">
            content_copy
          </span>
          {copied ? "Copiado" : "Copiar spec"}
        </button>
        <button
          data-testid="rec-toolbar-stop"
          onClick={onDetener}
          disabled={disabled}
          className="rounded bg-m3-primary px-3 py-1 font-headline text-label-sm text-m3-on-primary hover:bg-m3-on-primary-fixed hover:text-m3-on-primary-fixed-variant disabled:opacity-40 transition"
        >
          Detener
        </button>
      </div>
    </footer>
  );
}
