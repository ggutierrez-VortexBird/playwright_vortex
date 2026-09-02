"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WsServerMessage, WsClientMessage } from "@/lib/recorder/types";
import { ScreencastCanvas } from "./screencast-canvas";
import { ConnectionStatus } from "./connection-status";
import { PasoPanel } from "./paso-panel";
import { RecToolbar } from "./rec-toolbar";
import { GrabadorTopbar, type GrabadorTopbarMeta } from "./grabador-topbar";

interface GrabadorClientProps {
  wsUrl: string;
  urlInicial: string;
  topbarMeta: GrabadorTopbarMeta;
  /** When the session started (ISO string from the server). Passed to
   *  PasoPanel to anchor the elapsed-time cronómetro to sesion.createdAt
   *  instead of mount time. */
  startedAt?: string;
  /** ID de la sesion — usado por los handlers Detener / Descartar que
   *  hacen fetch a /api/grabador/sesiones/[id]. */
  sesionId: string;
  /** Pasos pre-cargados del server (HU-G3) — el PasoPanel se suscribe
   *  a los eventos `paso_agregado` para añadir los nuevos en vivo. */
  initialPasos?: import("./use-pasos-en-vivo").PasoEnVivo[];
}

type ConnState = "connecting" | "live" | "reconnecting" | "error" | "closed";

export function GrabadorClient({
  wsUrl,
  urlInicial,
  topbarMeta,
  startedAt,
  sesionId,
  initialPasos = [],
}: GrabadorClientProps) {
  const router = useRouter();
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [pageUrl, setPageUrl] = useState(urlInicial);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"detener" | "descartar" | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const heartbeatIntervalRef = useRef<number | null>(null);

  const sendWsMessage = useCallback((msg: WsClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    setConnState(reconnectAttemptRef.current === 0 ? "connecting" : "reconnecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState("live");
      reconnectAttemptRef.current = 0;
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = window.setInterval(() => {
        sendWsMessage({ type: "heartbeat" });
      }, 15000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsServerMessage;
        if (msg.type === "frame") {
          window.dispatchEvent(
            new CustomEvent("grabador-frame", { detail: { data: msg.data } }),
          );
        } else if (msg.type === "sesion_iniciando") {
          setConnState("connecting");
        } else if (msg.type === "sesion_lista") {
          setConnState("live");
        } else if (msg.type === "paso_agregado") {
          // HU-G3: broadcast `paso_agregado` to paso-panel via window event.
          // The recorder-worker is the single source of truth for pasos;
          // we just forward its events to the panel.
          window.dispatchEvent(
            new CustomEvent("grabador-paso", { detail: msg.paso }),
          );
        } else if (msg.type === "url_changed") {
          // El browser navego (click en link, history, hash, navigate
          // manual desde la URL bar). Sincronizamos el pageUrl local.
          setPageUrl(msg.url);
        } else if (msg.type === "error") {
          setErrorMsg(msg.msg);
          setConnState("error");
          ws.close();
        }
      } catch {
        // ignore parse error
      }
    };

    ws.onerror = () => {
      setConnState("error");
    };

    ws.onclose = (ev) => {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (ev.code === 4001 || ev.code === 4002) {
        setConnState("error");
        if (ev.code === 4001) {
          setErrorMsg("Token inválido o ya utilizado. Vuelve a iniciar la grabación.");
        } else if (ev.code === 4002) {
          setErrorMsg("La URL objetivo no responde.");
        }
        return;
      }
      const attempt = reconnectAttemptRef.current++;
      if (attempt < 5) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        setConnState("reconnecting");
        window.setTimeout(connect, delay);
      } else {
        setConnState("closed");
        setErrorMsg("No se pudo reconectar al grabador.");
      }
    };
  }, [wsUrl, sendWsMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * HU-G2 — "Detener y revisar" button.
   * 1. PATCH /api/grabador/sesiones/[id] con estado='detenida' (best-effort:
   *    si falla, igual navegamos para no dejar al usuario atascado).
   * 2. Stop el WS (sends {type:'stop'} which makes the worker persist
   *    estado='detenida' + endedAt — see ws-server.ts).
   * 3. Navega a /casos/grabar/[sesionId]/revisar (placeholder hasta HU-G8).
   */
  async function handleDetener() {
    if (busy) return;
    setBusy("detener");
    try {
      // Tell the recorder-worker we're done (idempotent stop).
      sendWsMessage({ type: "stop" });
      if (wsRef.current) {
        wsRef.current.close(1000, "user stopped");
      }
      // Persist estado='detenida' from the Next.js side too (defense in depth).
      await fetch(
        `/api/grabador/sesiones/${encodeURIComponent(sesionId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ estado: "detenida" }),
        },
      ).catch(() => undefined);
      router.push(`/casos/grabar/${sesionId}/revisar`);
    } finally {
      setBusy(null);
    }
  }

  /**
   * HU-G2 — "Descartar" button.
   * 1. Confirm with window.confirm (simple modal per spec).
   * 2. Close the WS cleanly.
   * 3. DELETE /api/grabador/sesiones/[id] (cascade on PasoGrabado).
   * 4. Navega a /casos.
   */
  async function handleDescartar() {
    if (busy) return;
    const confirmed = window.confirm(
      "¿Descartar la grabación? Se eliminarán todos los pasos capturados.",
    );
    if (!confirmed) return;
    setBusy("descartar");
    try {
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "Descartado por el usuario");
        } catch {
          // ignore
        }
      }
      await fetch(
        `/api/grabador/sesiones/${encodeURIComponent(sesionId)}`,
        { method: "DELETE" },
      ).catch(() => undefined);
      router.push("/casos");
    } finally {
      setBusy(null);
    }
  }

  // HU-G5/G7 — toolbar handlers. Wired here so the toolbar's disabled state
  // can also react to busy/error. In this PR we keep the signal-mode and
  // pause behavior light: toggles the local state and fires WS messages;
  // the full modals (Agregar verificación, Convertir a parámetro) are
  // mounted by the screen that uses them, not by the toolbar.
  const [signalActive, setSignalActive] = useState(false);
  const [paused, setPaused] = useState(false);

  function handleToggleSignal() {
    setSignalActive((prev) => !prev);
  }

  async function handleTogglePause() {
    if (!paused) {
      // Pause: tell the worker + persist estado='pausada'.
      sendWsMessage({ type: "pause" });
      try {
        await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/pause`,
          { method: "POST" },
        );
      } catch {
        // ignore — the next heartbeat or stop will sync state
      }
      setPaused(true);
    } else {
      // Resume.
      sendWsMessage({ type: "resume" });
      try {
        await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/resume`,
          { method: "POST" },
        );
      } catch {
        // ignore
      }
      setPaused(false);
    }
  }

  function handleActionVerificar() {
    // Stub: the live popover over the canvas opens the AgregarVerificacion
    // modal in a future wiring step. The toolbar shortcut mirrors the
    // popover's intent so the UX is consistent.
    setErrorMsg(
      "Elegí un elemento del navegador para agregar una verificación.",
    );
  }

  function handleActionParametro() {
    // Stub: same pattern as handleActionVerificar.
    setErrorMsg(
      "Elegí un elemento del navegador para convertirlo en parámetro.",
    );
  }

  const isLive = connState === "live";
  const isError = connState === "error" || connState === "closed";
  const topbarActionsDisabled = isError || busy !== null;

  return (
    <div className="-mx-6 -mt-6 flex flex-col min-h-[calc(100vh-100px)]">
      <GrabadorTopbar
        meta={topbarMeta}
        onDescartar={handleDescartar}
        onDetener={handleDetener}
        actionsDisabled={topbarActionsDisabled}
      />

      <div
        className="p-6 flex-1 grid grid-cols-12 gap-6 w-full"
        data-testid="workspace-grid"
      >
        {/* Left column: Browser + Toolbar */}
        <section className="col-span-12 lg:col-span-8 flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
          <div className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden relative">
            <BrowserChrome
              status={connState}
              pageUrl={pageUrl}
              onNavigate={(url) => sendWsMessage({ type: "navigate", url })}
              disabled={!isLive || paused}
            />

            <div className="flex-1 relative bg-m3-surface-container overflow-hidden">
              <ScreencastCanvas
                onInputEvent={(msg) => sendWsMessage(msg)}
                inputDisabled={!isLive || paused}
              />
              {!isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-m3-surface-container/80 backdrop-blur-sm">
                  <ConnectionStatus state={connState} mode="inline" />
                </div>
              )}
            </div>

            <RecToolbar
              disabled={!isLive}
              signalActive={signalActive}
              paused={paused}
              onToggleSignal={handleToggleSignal}
              onActionVerificar={handleActionVerificar}
              onActionParametro={handleActionParametro}
              onTogglePause={handleTogglePause}
            />
          </div>
        </section>

        {/* Right column: PASOS REGISTRADOS */}
        <section className="col-span-12 lg:col-span-4 flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
          <PasoPanel
            startedAt={startedAt}
            sesionId={sesionId}
            initialPasos={initialPasos}
          />
        </section>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-m3-error text-m3-on-error px-4 py-2 rounded shadow-lg font-body text-body-md z-50"
        >
          <strong>Error:</strong> {errorMsg}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Browser Chrome — subcomponent to keep grabador-client readable.     */
/* 3 dots + URL bar (editable, Enter navega) + REC badge.              */
/* ------------------------------------------------------------------ */
function BrowserChrome({
  status,
  pageUrl,
  onNavigate,
  disabled,
}: {
  status: ConnState;
  pageUrl: string;
  onNavigate: (url: string) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(pageUrl);

  // Mantener el input sincronizado con la URL real cuando cambia por
  // navegacion del browser (click en link, history, pushState) sin
  // haber sido el usuario quien edito el input.
  useEffect(() => {
    setInputValue(pageUrl);
  }, [pageUrl]);

  function submitUrl() {
    const url = inputValue.trim();
    if (!url || url === pageUrl) return;
    onNavigate(url);
  }

  return (
    <div className="bg-m3-surface-container border-b border-m3-outline-variant p-3 flex items-center gap-4">
      <div className="flex gap-2 px-2" aria-hidden="true">
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
      </div>
      <form
        className="flex-1 bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-1.5 flex items-center gap-2 min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          submitUrl();
        }}
        data-testid="browser-url-form"
      >
        <span className="material-symbols-outlined text-[16px] text-m3-on-surface-variant shrink-0">
          lock
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={submitUrl}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          aria-label="URL del navegador"
          data-testid="browser-url-input"
          className="flex-1 bg-transparent font-mono-code text-mono-code text-m3-on-surface text-xs outline-none min-w-0 disabled:opacity-60"
        />
        {disabled && (
          <span className="material-symbols-outlined text-[14px] text-m3-on-surface-variant shrink-0">
            edit_off
          </span>
        )}
      </form>
      <ConnectionStatus state={status} />
    </div>
  );
}
