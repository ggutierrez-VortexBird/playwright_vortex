"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WsServerMessage, WsClientMessage } from "@/lib/recorder/types";
import { ScreencastCanvas } from "./screencast-canvas";
import { ConnectionStatus } from "./connection-status";
import { UrlBar } from "./url-bar";
import { PasoPanel } from "./paso-panel";
import { RecToolbar } from "./rec-toolbar";

interface GrabadorClientProps {
  sessionId: string;
  initialToken: string;
  wsUrl: string;
  urlInicial: string;
}

type ConnState = "connecting" | "live" | "reconnecting" | "error" | "closed";

export function GrabadorClient({
  sessionId,
  initialToken,
  wsUrl,
  urlInicial,
}: GrabadorClientProps) {
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
      // Heartbeat cada 15s
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
          // Custom event dispatched; ScreencastCanvas listens
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
      // 4001 = invalid token (replay), 4002 = url failed, 1000 = stop
      if (ev.code === 4001 || ev.code === 4002) {
        setConnState("error");
        if (ev.code === 4001) {
          setErrorMsg("Token inválido o ya utilizado. Vuelve a iniciar la grabación.");
        } else if (ev.code === 4002) {
          setErrorMsg("La URL objetivo no responde.");
        }
        return;
      }
      // Auto-reconnect con backoff 1-5s
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

  return (
    <div className="vp-chrome">
      <header className="vp-header">
        <ConnectionStatus state={connState} />
        <UrlBar url={pageUrl} onChange={setPageUrl} />
        <span className="vp-session-id">Sesión: {sessionId.slice(0, 8)}</span>
      </header>

      <div className="vp-main">
        <div className="vp-stage">
          <ScreencastCanvas />
        </div>
        <aside className="vp-aside">
          <PasoPanel />
        </aside>
      </div>

      <footer className="vp-toolbar">
        <RecToolbar
          onStop={handleStop}
          disabled={connState === "error" || connState === "closed"}
        />
      </footer>

      {errorMsg && (
        <div
          role="alert"
          className="vp-error"
        >
          <strong>Error:</strong> {errorMsg}
        </div>
      )}
    </div>
  );
}