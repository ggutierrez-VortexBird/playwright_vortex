"use client";

/**
 * GrabadorTopbar — barra superior del modo grabador.
 *
 * Material 3 — surface container, primary action, secondary icon.
 * Botones: Detener y revisar / Descartar.
 *
 * Estado propio: confirmar descarte (una segunda click sobre Descartar
 * antes de X segundos confirma, sino se resetea).
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
}

const CONN_LABEL: Record<GrabadorTopbarProps["connState"], string> = {
  connecting: "Conectando…",
  live: "Grabando",
  reconnecting: "Reconectando…",
  error: "Error de conexión",
  closed: "Desconectado",
};

export function GrabadorTopbar({
  titulo,
  connState,
  stopping,
  onDetener,
  onDescartar,
}: GrabadorTopbarProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<number | null>(null);

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
      className="flex items-center justify-between gap-3 border-b border-m3-outline-variant bg-m3-surface-container px-4 py-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          data-testid="rec-dot"
          className={`h-3 w-3 rounded-full ${dotClass}`}
        />
        <span
          data-testid="rec-state"
          className="font-body text-body-sm text-m3-on-surface"
        >
          {CONN_LABEL[connState]}
        </span>
        <span className="font-headline text-headline-sm text-m3-on-surface truncate">
          {titulo}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          data-testid="descartar-btn"
          onClick={handleDescartarClick}
          className={[
            "rounded px-3 py-1.5 font-body text-body-sm transition",
            confirming
              ? "bg-red-700 text-white hover:bg-red-800"
              : "bg-transparent text-m3-on-surface-variant hover:bg-m3-surface-container-high",
          ].join(" ")}
        >
          {confirming ? "¿Confirmar descarte?" : "Descartar"}
        </button>
        <button
          data-testid="detener-btn"
          onClick={onDetener}
          disabled={stopping}
          className="rounded bg-m3-primary px-4 py-1.5 font-headline text-label-lg text-m3-on-primary hover:bg-m3-on-primary-fixed hover:text-m3-on-primary-fixed-variant disabled:opacity-50 transition"
        >
          {stopping ? "Deteniendo…" : "Detener y revisar"}
        </button>
      </div>
    </header>
  );
}
