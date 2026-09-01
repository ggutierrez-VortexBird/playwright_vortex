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
}

type ConnState = "connecting" | "live" | "reconnecting" | "error" | "closed";

export function GrabadorClient({
  wsUrl,
  urlInicial,
  topbarMeta,
}: GrabadorClientProps) {
  const router = useRouter();
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [pageUrl, setPageUrl] = useState(urlInicial);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  function handleStop() {
    sendWsMessage({ type: "stop" });
    if (wsRef.current) {
      wsRef.current.close();
    }
  }

  function handleDescartar() {
    if (wsRef.current) {
      wsRef.current.close(1000, "Descartado por el usuario");
    }
    router.push("/casos");
  }

  const isLive = connState === "live";
  const isError = connState === "error" || connState === "closed";
  const topbarActionsDisabled = isError;

  return (
    <div className="-mx-6 -mt-6 flex flex-col min-h-[calc(100vh-100px)]">
      <GrabadorTopbar
        meta={topbarMeta}
        onDescartar={handleDescartar}
        onDetener={handleStop}
        actionsDisabled={topbarActionsDisabled}
      />

      <div
        className="p-6 flex-1 grid grid-cols-12 gap-6 w-full"
        data-testid="workspace-grid"
      >
        {/* Left column: Browser + Toolbar */}
        <section className="col-span-12 lg:col-span-8 flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
          <div className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden relative">
            <BrowserChrome status={connState} pageUrl={pageUrl} />

            <div className="flex-1 relative bg-m3-surface-container overflow-hidden">
              <ScreencastCanvas />
              {!isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-m3-surface-container/80 backdrop-blur-sm">
                  <ConnectionStatus state={connState} mode="inline" />
                </div>
              )}
            </div>

            <RecToolbar disabled={!isLive} />
          </div>
        </section>

        {/* Right column: PASOS REGISTRADOS */}
        <section className="col-span-12 lg:col-span-4 flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
          <PasoPanel />
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
/* 3 dots + URL bar (lock icon) + REC badge.                          */
/* ------------------------------------------------------------------ */
function BrowserChrome({
  status,
  pageUrl,
}: {
  status: ConnState;
  pageUrl: string;
}) {
  return (
    <div className="bg-m3-surface-container border-b border-m3-outline-variant p-3 flex items-center gap-4">
      <div className="flex gap-2 px-2" aria-hidden="true">
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
        <span className="w-3 h-3 rounded-full bg-m3-outline-variant" />
      </div>
      <div className="flex-1 bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-1.5 flex items-center justify-between min-w-0">
        <span className="font-mono-code text-mono-code text-m3-on-surface-variant text-xs truncate">
          {pageUrl}
        </span>
        <span className="material-symbols-outlined text-[16px] text-m3-on-surface-variant ml-2 shrink-0">
          lock
        </span>
      </div>
      <ConnectionStatus state={status} />
    </div>
  );
}
