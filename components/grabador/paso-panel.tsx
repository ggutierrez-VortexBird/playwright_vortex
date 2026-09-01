"use client";

import { useEffect, useRef, useState } from "react";
import {
  usePasosEnVivo,
  type PasoEnVivo,
} from "./use-pasos-en-vivo";

/**
 * Right column of the EN VIVO view: "PASOS REGISTRADOS" panel.
 *
 * Visual fidelity: `fase2/mockups/grabar-test.html` lines 273-362.
 *
 * HU-G3 (cableado en PR-2): los pasos llegan en vivo via
 * `usePasosEnVivo(sessionId, initialPasos)`. El componente:
 *   - Muestra el empty state inicial ("Esperando interacción…") cuando
 *     no hay pasos.
 *   - Renderiza cada paso con su numero, descripcion, badge
 *     "Recién agregado" durante 3s tras aparecer.
 *   - Auto-scroll al fondo cuando llega un paso nuevo.
 *
 * Mantiene compatibilidad con la prop legacy `pasos: PasoItem[]` para
 * callers que solo necesitan la vista estática (tests existentes).
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
  /**
   * Legacy static pasos. If provided, the panel renders these without
   * subscribing to live events. Used by tests + the topbar storybook.
   * If both `pasos` and `initialPasos`+`sessionId` are provided, `pasos`
   * takes precedence (static mode).
   */
  pasos?: PasoItem[];
  /** Server-loaded pasos for live mode. */
  initialPasos?: PasoEnVivo[];
  /** Sesion ID — enables live WS event subscription. */
  sesionId?: string;
  /** When the session started; used to compute the elapsed timer.
   *  Accepts Date or ISO string (from server-rendered pages).
   *  Defaults to "now" — the timer counts up from mount. */
  startedAt?: Date | string;
  /** ms the "Recién agregado" badge stays visible (default 3000). */
  recienAgregadoMs?: number;
}

function parseStartedAt(value: Date | string | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PasoPanel({
  pasos,
  initialPasos = [],
  sesionId,
  startedAt,
  recienAgregadoMs = 3000,
}: PasoPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live mode when sesionId is provided AND caller hasn't forced static mode.
  const liveMode = !pasos && Boolean(sesionId);
  const pasosEnVivo = usePasosEnVivo(
    sesionId ?? "",
    liveMode ? initialPasos : [],
  );

  useEffect(() => {
    const start = parseStartedAt(startedAt);
    setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  // Auto-scroll to bottom when pasos grow in live mode.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastSeenCountRef = useRef<number>(liveMode ? pasosEnVivo.length : -1);
  useEffect(() => {
    if (!liveMode) return;
    if (pasosEnVivo.length > lastSeenCountRef.current) {
      // Scroll the LAST child into view smoothly.
      const el = bodyRef.current;
      if (el) {
        const lastChild = el.lastElementChild;
        if (lastChild && typeof lastChild.scrollIntoView === "function") {
          lastChild.scrollIntoView({ behavior: "smooth", block: "end" });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      }
    }
    lastSeenCountRef.current = pasosEnVivo.length;
  }, [pasosEnVivo.length, liveMode]);

  // Compute the set of paso IDs that should show the "Recién agregado" badge.
  // A paso shows the badge for `recienAgregadoMs` after it appears.
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!liveMode) return;
    const now = Date.now();
    const newIds = new Set<string>();
    pasosEnVivo.forEach((p, idx) => {
      // Only the last 1 paso shows "Recién agregado" to avoid noise.
      if (idx === pasosEnVivo.length - 1) {
        newIds.add(p.id);
      }
    });
    // Schedule timeouts to remove badges.
    pasosEnVivo.forEach((p) => {
      if (newIds.has(p.id) && !recentIds.has(p.id)) {
        const t = window.setTimeout(() => {
          setRecentIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
          timeoutsRef.current.delete(p.id);
        }, recienAgregadoMs);
        timeoutsRef.current.set(p.id, t);
      }
    });
    setRecentIds(newIds);
    return () => {
      // Clean up timeouts on unmount or pasos change.
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, [pasosEnVivo, liveMode, recienAgregadoMs]);

  // Determine which list to render + counts.
  const totalPasos = pasos ? pasos.length : pasosEnVivo.length;
  const headerCount = totalPasos;

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
            {headerCount} {headerCount === 1 ? "paso" : "pasos"}
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
        ref={bodyRef}
      >
        {pasos ? (
          // Static mode: legacy PasoItem[].
          <>
            {pasos.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {pasos.map((paso, idx) => (
                  <PasoRow
                    key={`${paso.numero}-${idx}`}
                    paso={paso}
                    showDivider={
                      idx < pasos.length - 1 && !pasos[idx + 1]?.esVerificacion
                    }
                  />
                ))}
                <EmptyState />
              </>
            )}
          </>
        ) : pasosEnVivo.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {pasosEnVivo.map((paso) => (
              <PasoRealRow
                key={paso.id}
                paso={paso}
                recienAgregado={recentIds.has(paso.id)}
              />
            ))}
            <EmptyState />
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state — mockup lines 357-359.                                */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div
      className="mt-6 py-4 flex items-center justify-center border-2 border-dashed border-m3-outline-variant/50 rounded-lg text-m3-on-surface-variant bg-m3-surface-container-lowest"
      data-testid="paso-empty-state"
    >
      <span className="text-sm">Esperando interacción en el navegador...</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PasoRow (legacy) — single static step entry.                       */
/* ------------------------------------------------------------------ */
function PasoRow({ paso, showDivider }: { paso: PasoItem; showDivider: boolean }) {
  const numeroStr = paso.numero.toString().padStart(2, "0");

  if (paso.esVerificacion) {
    return (
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
    );
  }

  if (paso.esActivo) {
    return (
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

/* ------------------------------------------------------------------ */
/* PasoRealRow — DB-shaped paso from PasoGrabado. HU-G3 visual.      */
/* ------------------------------------------------------------------ */
function PasoRealRow({
  paso,
  recienAgregado,
}: {
  paso: PasoEnVivo;
  recienAgregado: boolean;
}) {
  const numeroStr = paso.numero.toString().padStart(2, "0");
  const isEspera = paso.tipo === "esperar";
  const isVerificacion = paso.tipo === "verificar";

  if (isVerificacion) {
    return (
      <div
        className="flex items-start gap-4 bg-m3-secondary-container/10 -mx-4 px-4 py-3 rounded-r border-l-4 border-m3-secondary-container mb-4"
        data-testid={`paso-verificacion-${paso.id}`}
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
          <p className="text-sm text-m3-on-surface">{paso.descripcion}</p>
          {recienAgregado && (
            <span
              className="text-[10px] text-m3-secondary font-bold uppercase tracking-wider mt-1 inline-block"
              data-testid={`recien-agregado-${paso.id}`}
            >
              Recién agregado
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 items-start group"
      data-testid={`paso-real-${paso.id}`}
    >
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono-code text-xs ${
          isEspera
            ? "bg-m3-surface-container text-m3-on-surface-variant"
            : "bg-m3-surface-container-high text-m3-on-surface-variant"
        }`}
      >
        {numeroStr}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="font-body text-body-md text-m3-on-surface leading-snug">
          {paso.descripcion}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {paso.parametroNombre && (
            <span className="font-mono-code text-[11px] bg-m3-tertiary-container text-m3-on-tertiary-container px-1.5 py-0.5 rounded">
              {`{{${paso.parametroNombre}}}`}
            </span>
          )}
          {paso.esValorSensible && (
            <span
              className="material-symbols-outlined text-[14px] text-yellow-600"
              title="Valor sensible — enmascarado"
              aria-label="Valor sensible"
            >
              lock
            </span>
          )}
          {recienAgregado && (
            <span
              className="text-[10px] text-m3-secondary font-bold uppercase tracking-wider"
              data-testid={`recien-agregado-${paso.id}`}
            >
              Recién agregado
            </span>
          )}
        </div>
      </div>
    </div>
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
