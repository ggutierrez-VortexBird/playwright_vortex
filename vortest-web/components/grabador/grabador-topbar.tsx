"use client";

/**
 * GrabadorTopbar — barra de control de la sesión de grabación activa.
 *
 * Look & feel: réplica de la "ActiveRecordingSubHeader" del mockup
 * documentacion/referencias-diseño/cambios/grabador.html — badge de
 * grabación en vivo con pulso, cronómetro, nombre del caso, y las
 * acciones Descartar / Detener y procesar.
 *
 * Estado propio: confirmar descarte (una segunda click sobre Descartar
 * antes de X segundos confirma, sino se resetea) + cronómetro en vivo
 * calculado a partir de `startedAt`.
 */
import { useEffect, useRef, useState } from "react";

export interface GrabadorTopbarProps {
  /** Titulo de la sesión (input "Nombre" del form). */
  titulo: string;
  /** Estado de conexión WS: connecting | live | reconnecting | error | closed. */
  connState:
    | "connecting"
    | "live"
    | "reconnecting"
    | "error"
    | "closed";
  /** True si el botón Detener está disabled (durante el proceso de stop). */
  stopping: boolean;
  /** Click en Detener. Manda {type:'stop'} al worker. */
  onDetener: () => void;
  /** Click en Descartar. Elimina la sesión + spec sin pasar por /revisar. */
  onDescartar: () => void;
  /** ISO server-time de inicio de la sesión, para el cronómetro. */
  startedAt?: string;
  /**
   * "idle" = todavía no se creó la sesión real ni se abrió el navegador:
   * en vez de Descartar/Detener se muestra Cancelar + un botón Play que
   * dispara `onIniciar`. Default "session" (comportamiento de siempre).
   */
  variant?: "session" | "idle";
  /** Click en el botón Play (solo variant="idle"). */
  onIniciar?: () => void;
  /** True mientras se está creando la sesión real (spinner en el botón Play). */
  iniciando?: boolean;
}

const CONN_LABEL: Record<GrabadorTopbarProps["connState"], string> = {
  connecting: "Conectando…",
  live: "Grabando en vivo",
  reconnecting: "Reconectando…",
  error: "Error de conexión",
  closed: "Desconectado",
};

const CONN_BADGE_CLASS: Record<GrabadorTopbarProps["connState"], string> = {
  connecting: "bg-m3-info-container text-m3-info border-m3-info/30",
  live: "bg-m3-error-container text-m3-error border-m3-error/20",
  reconnecting: "bg-m3-info-container text-m3-info border-m3-info/30",
  error: "bg-m3-error-container text-m3-error border-m3-error/20",
  closed: "bg-m3-surface-container-high text-m3-on-surface-variant border-m3-outline-variant",
};

function useElapsed(startedAt?: string): string | null {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    if (Number.isNaN(start)) return;

    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function GrabadorTopbar({
  titulo,
  connState,
  stopping,
  onDetener,
  onDescartar,
  startedAt,
  variant = "session",
  onIniciar,
  iniciando = false,
}: GrabadorTopbarProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<number | null>(null);
  const elapsed = useElapsed(startedAt);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function handleDescartarClick() {
    if (confirming) {
      setConfirming(false);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      onDescartar();
      return;
    }
    setConfirming(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setConfirming(false);
      timerRef.current = null;
    }, 3000);
  }

  const dotClass =
    connState === "live"
      ? "bg-red-500 animate-pulse"
      : connState === "connecting" || connState === "reconnecting"
        ? "bg-amber-500"
        : "bg-slate-500";

  return (
    <header
      data-testid="grabador-topbar"
      className="flex flex-wrap items-center justify-between gap-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 shadow-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {variant === "idle" ? (
          <div className="flex items-center gap-2 rounded-full border border-m3-info/30 bg-m3-info-container px-3 py-1 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-info">
            <span className="h-2.5 w-2.5 rounded-full bg-m3-info" />
            Listo para grabar
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 font-label text-label-sm font-semibold uppercase tracking-wide ${CONN_BADGE_CLASS[connState]}`}
          >
            <span className="relative inline-flex h-2.5 w-2.5">
              {connState === "live" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-m3-error/60" />
              )}
              <span data-testid="rec-dot" className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`} />
            </span>
            <span data-testid="rec-state">{CONN_LABEL[connState]}</span>
          </div>
        )}

        {elapsed && (
          <div className="flex items-center gap-1.5 rounded-full border border-m3-outline-variant bg-m3-surface-container px-2.5 py-1 font-mono-code text-label-sm font-semibold text-m3-on-surface">
            <span className="material-symbols-outlined text-[16px] text-m3-on-surface-variant">schedule</span>
            {elapsed}
          </div>
        )}

        <div className="hidden h-5 w-px bg-m3-outline-variant sm:block" />

        <h2 className="truncate font-headline text-headline-sm text-m3-on-surface">{titulo}</h2>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {variant === "idle" ? (
          <>
            <button
              data-testid="descartar-btn"
              onClick={onDescartar}
              disabled={iniciando}
              className="rounded-lg border border-m3-outline-variant px-3.5 py-1.5 font-label text-label-sm font-medium text-m3-on-surface-variant transition hover:bg-m3-surface-container-high disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              data-testid="detener-btn"
              onClick={onIniciar}
              disabled={iniciando}
              className="flex items-center gap-2 rounded-lg bg-m3-inverse-surface px-4 py-1.5 font-label text-label-sm font-semibold text-m3-inverse-on-surface shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {iniciando ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              )}
              {iniciando ? "Iniciando grabador…" : "Iniciar grabación"}
            </button>
          </>
        ) : (
          <>
            <button
              data-testid="descartar-btn"
              onClick={handleDescartarClick}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 font-label text-label-sm font-medium transition",
                confirming
                  ? "border-m3-error bg-m3-error text-white hover:bg-m3-error/90"
                  : "border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-error/40 hover:bg-m3-error-container hover:text-m3-error",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              {confirming ? "¿Confirmar descarte?" : "Descartar sesión"}
            </button>
            <button
              data-testid="detener-btn"
              onClick={onDetener}
              disabled={stopping}
              className="flex items-center gap-2 rounded-lg bg-m3-inverse-surface px-4 py-1.5 font-label text-label-sm font-semibold text-m3-inverse-on-surface shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-m3-error" />
              {stopping ? "Deteniendo…" : "Detener y procesar prueba"}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
