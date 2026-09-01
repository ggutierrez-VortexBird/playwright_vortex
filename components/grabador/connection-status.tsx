"use client";

interface ConnectionStatusProps {
  state: "connecting" | "live" | "reconnecting" | "error" | "closed";
  /**
   * Display mode:
   * - undefined (default) → compact REC badge for the browser chrome.
   * - "inline" → full label badge used inside the canvas overlay.
   *
   * Source: mockup grabar-test.html line 250 (compact) vs lines
   * 277-283 (full label inside the right panel).
   */
  mode?: "inline";
}

const LABEL: Record<ConnectionStatusProps["state"], string> = {
  connecting: "INICIANDO",
  live: "EN VIVO",
  reconnecting: "RECONECTANDO",
  error: "ERROR",
  closed: "DESCONECTADO",
};

const COLOR_LABEL: Record<ConnectionStatusProps["state"], string> = {
  connecting: "Conectando al grabador…",
  live: "Grabando en vivo",
  reconnecting: "Reintentando conexión…",
  error: "Conexión perdida",
  closed: "Sesión finalizada",
};

/**
 * Connection status indicator.
 *
 * - Default: compact "REC" pill with pulsing red dot (browser chrome).
 * - inline mode: full label badge (EN VIVO / RECONECTANDO / etc.) used
 *   in the canvas overlay and other contextual surfaces.
 *
 * Visual fidelity: mockup grabar-test.html lines 250 and 277-283.
 */
export function ConnectionStatus({ state, mode }: ConnectionStatusProps) {
  const isLive = state === "live";

  if (mode === "inline") {
    return (
      <div
        className="flex flex-col items-center gap-3 text-center"
        data-testid="connection-status-inline"
      >
        <div
          className={`flex items-center gap-2 font-label text-label-sm font-bold px-3 py-1.5 rounded-full shadow-sm ${
            isLive
              ? "bg-m3-error text-m3-on-error"
              : state === "error" || state === "closed"
                ? "bg-m3-surface-container-high text-m3-error border border-m3-error"
                : "bg-m3-surface-container-high text-m3-on-surface-variant"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full bg-current pulse-red ${isLive ? "" : "opacity-60"}`}
          />
          {LABEL[state]}
        </div>
        <p className="font-body text-body-md text-m3-on-surface-variant max-w-xs">
          {COLOR_LABEL[state]}
        </p>
      </div>
    );
  }

  // Compact REC badge for the browser chrome.
  return (
    <div
      className="inline-flex items-center gap-2 bg-m3-error text-m3-on-error font-label text-label-sm font-bold px-3 py-1 rounded-full shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={isLive ? "Grabando en vivo" : COLOR_LABEL[state]}
      data-testid="connection-status"
    >
      <span className="w-2 h-2 bg-m3-on-error rounded-full pulse-red" />
      REC
    </div>
  );
}
