"use client";

import { useState } from "react";

/**
 * RecToolbar — floating toolbar centered at the bottom of the browser canvas.
 *
 * Visual fidelity: `fase2/mockups/grabar-test.html` lines 254-269.
 *
 * HU-G5 (HU-G7 partial): all 4 buttons are now wired.
 *   - "Señalar elemento" toggle (HU-G5): when on, the parent enables
 *     mouse-tracking over the canvas and shows highlight rectangles.
 *   - "Verificar" / "Parámetro" / "Pausar": shortcuts that emit
 *     callbacks; if signal mode is off, the parent shows a toast asking
 *     the user to enable Señalar elemento first.
 *
 * The toolbar is purely visual — all state management lives in
 * `GrabadorClient`. The parent passes `signalActive`, `paused`, and
 * three callbacks: `onToggleSignal`, `onActionVerificar`, `onActionParametro`,
 * `onTogglePause`.
 */

export type ToolbarVerificarAction = () => void;
export type ToolbarParametroAction = () => void;

export interface RecToolbarProps {
  /** Whether the live screencast is active (disables all controls). */
  disabled?: boolean;
  /** Signal mode on → cursor changes to crosshair + hover highlights appear. */
  signalActive: boolean;
  /** Pause on → events stopped being recorded. */
  paused: boolean;
  onToggleSignal: () => void;
  onActionVerificar: ToolbarVerificarAction;
  onActionParametro: ToolbarParametroAction;
  onTogglePause: () => void;
}

/** Lightweight toast for the "Señalá un elemento primero" hint. */
function useToast(): [
  string | null,
  (msg: string | null) => void,
] {
  const [msg, setMsg] = useState<string | null>(null);
  return [
    msg,
    (next) => {
      setMsg(next);
      if (next) {
        window.setTimeout(() => setMsg((cur) => (cur === next ? null : cur)), 2500);
      }
    },
  ];
}

export function RecToolbar({
  disabled = false,
  signalActive,
  paused,
  onToggleSignal,
  onActionVerificar,
  onActionParametro,
  onTogglePause,
}: RecToolbarProps) {
  const [toast, setToast] = useToast();

  function guardedShortcut(action: () => void, label: string) {
    if (!signalActive) {
      setToast("Señalá un elemento primero para usar esta acción");
      return;
    }
    void action();
  }

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-m3-surface-container-lowest border border-m3-outline-variant shadow-lg rounded-xl px-2 py-2 flex items-center gap-1 z-20"
      data-testid="rec-toolbar"
    >
      {/* Primary action — Señalar elemento toggle */}
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleSignal}
        aria-pressed={signalActive}
        title={
          signalActive
            ? "Salir del modo señalar elemento"
            : "Señalar elemento — pasar el cursor sobre la página y hacer clic para elegir"
        }
        data-testid="tool-senalar"
        className={
          signalActive
            ? "flex items-center gap-2 bg-m3-secondary text-m3-on-secondary hover:bg-m3-secondary/90 px-4 py-2 rounded-lg font-label text-label-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            : "flex items-center gap-2 bg-m3-secondary-container text-m3-on-secondary-container hover:bg-m3-secondary-fixed px-4 py-2 rounded-lg font-label text-label-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        <span className="material-symbols-outlined text-[18px]">touch_app</span>
        <span>Señalar elemento</span>
      </button>

      {/* Vertical divider */}
      <div
        className="w-px h-8 bg-m3-outline-variant mx-2"
        aria-hidden="true"
      />

      {/* Icon-only buttons — Verificar / Parámetro / Pausar */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => guardedShortcut(onActionVerificar, "Verificar")}
        title="Agregar verificación — primero señalá un elemento"
        data-testid="tool-verificar"
        className="flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[20px]">fact_check</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => guardedShortcut(onActionParametro, "Parámetro")}
        title="Convertir en parámetro — primero señalá un elemento"
        data-testid="tool-parametro"
        className="flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[20px]">data_object</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onTogglePause}
        title={paused ? "Reanudar grabación" : "Pausar grabación"}
        aria-pressed={paused}
        data-testid="tool-pausar"
        className={
          paused
            ? "flex items-center justify-center bg-m3-tertiary-container text-m3-on-tertiary-container hover:bg-m3-tertiary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            : "flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        <span className="material-symbols-outlined text-[20px]">
          {paused ? "play_arrow" : "pause"}
        </span>
      </button>

      {/* Toast — auto-hides after 2.5s. */}
      {toast && (
        <div
          role="status"
          data-testid="rec-toolbar-toast"
          className="absolute -top-10 left-1/2 -translate-x-1/2 bg-m3-ink text-m3-on-ink px-3 py-1.5 rounded shadow-md font-body text-body-sm whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
