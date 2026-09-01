"use client";

/**
 * Topbar in-page para la vista EN VIVO del grabador (HU-G1).
 *
 * Visual fidelity: `fase2/mockups/grabar-test.html` lines 199-233.
 * Esta topbar vive DENTRO del page content (debajo del topbar global
 * del dashboard), no la reemplaza. Por eso usa el lenguaje visual M3
 * del mockup (secondary-container accent, M3 surface tokens) en vez de
 * la paleta ink/rail del shell global.
 */

export interface GrabadorTopbarMeta {
  nombre: string;
  /** Short session id shown like `SES-A1B2` (mockup uses REQ-XXXX). */
  sesionShortId: string;
  ambiente: string;
  navegador: string;
  /** Empty string = "Manual" placeholder per mockup. */
  credencialNombre: string;
}

interface GrabadorTopbarProps {
  meta: GrabadorTopbarMeta;
  onDescartar: () => void;
  onDetener: () => void;
  /** Disable Descartar/Detener while the WS is not live yet or errored. */
  actionsDisabled?: boolean;
}

export function GrabadorTopbar({
  meta,
  onDescartar,
  onDetener,
  actionsDisabled = false,
}: GrabadorTopbarProps) {
  const credencialDisplay = meta.credencialNombre.trim() || "Manual";
  return (
    <header
      className="bg-m3-surface-container-lowest border-b border-m3-outline-variant"
      data-testid="grabador-topbar"
    >
      <div className="flex justify-between items-center px-6 py-4 gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-headline text-headline-md font-semibold text-m3-primary truncate">
            {meta.nombre}
          </h2>
          <p className="font-mono-code text-mono-code text-m3-on-surface-variant mt-1 text-xs">
            {meta.sesionShortId} · Ambiente {meta.ambiente} · Credencial:{" "}
            {credencialDisplay}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Chips: Entorno + Navegador */}
          <div className="flex gap-2 text-sm">
            <div className="bg-m3-surface-container-high px-3 py-1.5 rounded flex flex-col justify-center">
              <span className="text-xs text-m3-on-surface-variant">Entorno:</span>
              <span className="text-sm text-m3-primary font-medium">
                {meta.ambiente}
              </span>
            </div>
            <div className="bg-m3-surface-container-high px-3 py-1.5 rounded flex flex-col justify-center">
              <span className="text-xs text-m3-on-surface-variant">Navegador:</span>
              <span className="text-sm text-m3-primary font-medium">
                {meta.navegador}
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-m3-outline-variant mx-2 hidden sm:block" aria-hidden="true" />

          <button
            type="button"
            onClick={onDescartar}
            disabled={actionsDisabled}
            data-testid="topbar-descartar"
            className="px-4 py-2 border border-m3-outline text-m3-on-surface rounded font-label text-label-sm font-medium hover:bg-m3-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onDetener}
            disabled={actionsDisabled}
            data-testid="topbar-detener"
            className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded font-label text-label-sm font-medium hover:bg-m3-secondary-fixed transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Detener y revisar
          </button>
        </div>
      </div>
    </header>
  );
}
