"use client";

import { useEffect, useState } from "react";

/**
 * Right column of the EN VIVO view: "PASOS REGISTRADOS" panel.
 *
 * Visual fidelity: `fase2/mockups/grabar-test.html` lines 273-362.
 *
 * In HU-G1, step recording (HU-G3) is not implemented, so only the
 * empty-state placeholder is visible. The component still renders the
 * full card chrome (header with elapsed timer + body) so the layout
 * stays stable when G3 lands.
 *
 * The component accepts an optional `pasos` prop so a future G3
 * implementation can plug in step rows without changing the layout.
 */
export interface PasoItem {
  /** 1-based step number. */
  numero: number;
  /** Short title shown in the row. */
  titulo: string;
  /** Optional `goto:` or similar metadata line in mono-code. */
  meta?: string;
  /** Inline parameter chip rendered into the title. */
  parametro?: { nombre: string; placeholder: string };
  /** Marks the step as a verification (yellow accent). */
  esVerificacion?: boolean;
  /** Marks the step as the currently-active step (highlight). */
  esActivo?: boolean;
}

interface PasoPanelProps {
  pasos?: PasoItem[];
  /** When the session started; used to compute the elapsed timer.
   *  Defaults to "now" — the timer counts up from mount. */
  startedAt?: Date;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PasoPanel({ pasos = [], startedAt }: PasoPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const start = startedAt ?? new Date();
    setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <div
      className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden"
      data-testid="paso-panel"
    >
      {/* Header */}
      <div className="p-5 border-b border-m3-outline-variant bg-m3-surface-container-lowest flex justify-between items-center gap-3">
        <h3 className="font-headline text-headline-md text-m3-primary tracking-wide">
          PASOS REGISTRADOS
        </h3>
        <div className="flex items-center gap-4">
          <span className="font-label text-xs text-m3-on-surface-variant bg-m3-surface-container-high px-2.5 py-1 rounded-full">
            {pasos.length} {pasos.length === 1 ? "paso" : "pasos"}
          </span>
          <span
            className="font-mono-code text-mono-code text-m3-primary flex items-center gap-1.5"
            aria-label="Tiempo transcurrido"
          >
            <span className="w-2 h-2 bg-m3-error rounded-full pulse-red" />
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto p-6 flex flex-col"
        data-testid="paso-panel-body"
      >
        {pasos.length === 0 ? (
          <div className="mt-6 py-4 flex items-center justify-center border-2 border-dashed border-m3-outline-variant/50 rounded-lg text-m3-on-surface-variant bg-m3-surface-container-lowest">
            <span className="text-sm">
              Esperando interacción en el navegador...
            </span>
          </div>
        ) : (
          <>
            {pasos.map((paso, idx) => (
              <PasoRow
                key={`${paso.numero}-${idx}`}
                paso={paso}
                showDivider={idx < pasos.length - 1 && !pasos[idx + 1]?.esVerificacion}
              />
            ))}
            {/* Empty state still visible while waiting for next interaction */}
            <div className="mt-6 py-4 flex items-center justify-center border-2 border-dashed border-m3-outline-variant/50 rounded-lg text-m3-on-surface-variant bg-m3-surface-container-lowest">
              <span className="text-sm">
                Esperando interacción en el navegador...
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PasoRow — single step entry. Renders inline parameter chips and    */
/* applies the verification / active step accent per mockup lines     */
/* 320-329 and 346-355.                                               */
/* ------------------------------------------------------------------ */
function PasoRow({ paso, showDivider }: { paso: PasoItem; showDivider: boolean }) {
  const numeroStr = paso.numero.toString().padStart(2, "0");

  if (paso.esVerificacion) {
    return (
      <>
        <div
          className="flex items-start gap-4 bg-m3-secondary-container/10 -mx-4 px-4 py-3 rounded-r border-l-4 border-m3-secondary-container mb-4"
          data-testid={`paso-verificacion-${paso.numero}`}
        >
          <div className="font-mono-code text-sm text-m3-secondary-container mt-0.5 w-6 text-right font-medium">
            {numeroStr}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-m3-secondary-container mb-1">
              <span className="material-symbols-outlined text-[16px]">flag</span>
              <span className="font-label text-[11px] font-bold uppercase tracking-wider">
                Verificación
              </span>
            </div>
            <p className="text-sm text-m3-on-surface">{paso.titulo}</p>
          </div>
        </div>
      </>
    );
  }

  if (paso.esActivo) {
    return (
      <>
        <div
          className="flex items-start gap-4 bg-m3-surface-container -mx-4 px-4 py-3 rounded-r border-l-4 border-m3-secondary-container mt-2"
          data-testid={`paso-activo-${paso.numero}`}
        >
          <div className="font-mono-code text-sm text-m3-primary font-bold mt-0.5 w-6 text-right">
            {numeroStr}
          </div>
          <div className="flex-1">
            <p className="text-sm text-m3-primary font-medium">{paso.titulo}</p>
            {paso.meta && (
              <p className="font-mono-code text-[11px] text-m3-on-surface-variant mt-1">
                {paso.meta}
              </p>
            )}
          </div>
          <button
            type="button"
            className="text-m3-outline hover:text-m3-error transition-colors p-1"
            title="Eliminar paso"
            aria-label={`Eliminar paso ${paso.numero}`}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="font-mono-code text-sm text-m3-outline mt-0.5 w-6 text-right">
          {numeroStr}
        </div>
        <div className="flex-1 pb-4">
          <p className="text-sm text-m3-on-surface">
            {renderTituloConParametro(paso)}
          </p>
          {paso.meta && (
            <p className="font-mono-code text-[11px] text-m3-on-surface-variant mt-1">
              {paso.meta}
            </p>
          )}
        </div>
      </div>
      {showDivider && <div className="step-divider" aria-hidden="true" />}
    </>
  );
}

/** Render the title text and inline-replace `{{name}}` with a chip. */
function renderTituloConParametro(paso: PasoItem): React.ReactNode {
  const titulo = paso.titulo;
  if (!paso.parametro) return titulo;
  const placeholder = `{{${paso.parametro.nombre}}}`;
  const idx = titulo.indexOf(placeholder);
  if (idx === -1) return titulo;
  return (
    <>
      {titulo.slice(0, idx)}
      <span
        className="font-mono-code bg-m3-surface-container-high px-1.5 py-0.5 rounded text-m3-primary text-xs"
        title={`Parámetro: ${paso.parametro.placeholder}`}
      >
        {`{{${paso.parametro.nombre}}}`}
      </span>
      {titulo.slice(idx + placeholder.length)}
    </>
  );
}
