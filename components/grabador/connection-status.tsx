"use client";

interface ConnectionStatusProps {
  state: "connecting" | "live" | "reconnecting" | "error" | "closed";
}

const LABEL: Record<ConnectionStatusProps["state"], string> = {
  connecting: "INICIANDO",
  live: "EN VIVO",
  reconnecting: "RECONECTANDO",
  error: "ERROR",
  closed: "DESCONECTADO",
};

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const isLive = state === "live";
  const isError = state === "error" || state === "closed";
  return (
    <div
      className={`rec-badge ${isLive ? "rec-live" : isError ? "rec-error" : "rec-idle"}`}
      role="status"
      data-testid="connection-status"
    >
      <span className="rec-dot" />
      <span className="rec-label">{LABEL[state]}</span>
    </div>
  );
}