"use client";

/**
 * GrabadorClient — composición del modo grabador en el slot principal.
 *
 * Backend (V2): el recorder-worker spawnea `npx playwright codegen` y
 * vigila el .spec.ts. Cada cambio broadcastea `spec_updated` por WS con
 * `{content, bytes, changedAt}`.
 *
 * UI: Topbar (estado + título + Detener/Descartar) + BrowserChrome (URL) +
 * grilla de contenido (RecordingInstructions + RecordingGuide).
 *
 * Mensajes WS (V2, 3 variantes): spec_updated / sesion_detenida / error.
 * Bot `pause`/`resume` ya no se usa — codegen maneja el pause desde
 * su toolbar nativa. El botón "Señalar elemento" desapareció con el
 * signal mode de V1 (HU-G5).
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { WsServerMessage, WsClientMessage } from "@/lib/recorder/types";

import { GrabadorTopbar } from "@/components/grabador/grabador-topbar";
import { BrowserChrome } from "@/components/grabador/browser-chrome";
import { RecordingInstructions } from "@/components/grabador/recording-instructions";
import { RecordingGuide } from "@/components/grabador/recording-guide";
import { parseSpecToSteps, type SpecLineKind } from "@/lib/recorder/parse-spec";

export interface GrabadorClientProps {
  wsUrl: string;
  urlInicial: string;
  sesionId: string;
  /** ISO server-time cuando se creó la sesión. */
  startedAt?: string;
  /** Título de la sesión (nombre tipeado en el form). */
  titulo: string;
}

type ConnState = "connecting" | "live" | "reconnecting" | "error" | "closed";

export function GrabadorClient({
  wsUrl,
  urlInicial,
  sesionId,
  startedAt,
  titulo,
}: GrabadorClientProps) {
  const router = useRouter();
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [spec, setSpec] = useState<string>("");
  const [bytes, setBytes] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>(urlInicial);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const sendWsMessage = useCallback((msg: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    setConnState(
      reconnectAttemptRef.current === 0 ? "connecting" : "reconnecting",
    );
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState("live");
      reconnectAttemptRef.current = 0;
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = window.setInterval(() => {
        sendWsMessage({ type: "heartbeat" });
      }, 15_000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsServerMessage;
        if (msg.type === "spec_updated") {
          setSpec(msg.content);
          setBytes(msg.bytes);
          setLastUpdateAt(msg.changedAt);
          // Sincronizar URL actual si el worker la incluye
          if (msg.currentUrl) setCurrentUrl(msg.currentUrl);
        } else if (msg.type === "sesion_detenida") {
          if (!stopping) setStopping(true);
          if (wsRef.current) wsRef.current.close(1000, "sesion_detenida");
          // El motivo viaja a la pantalla de revisión: cuando la grabación
          // terminó porque se cerró la ventana del navegador, el usuario no
          // pulsó nada acá y conviene explicarle por qué cambió de pantalla.
          const motivo = msg.reason ? `?motivo=${encodeURIComponent(msg.reason)}` : "";
          router.push(`/casos/grabar/${sesionId}/revisar${motivo}`);
        } else if (msg.type === "error") {
          setErrorMsg(msg.msg);
          setConnState("error");
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onerror = () => setConnState("error");
    ws.onclose = (ev) => {
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (ev.code === 4001) {
        setConnState("error");
        setErrorMsg(
          "Token inválido o ya utilizado. Vuelve a iniciar la grabación.",
        );
        return;
      }
      if (ev.code === 4004) {
        setConnState("error");
        setErrorMsg(
          "La sesión no se encuentra activa en el recorder-worker.",
        );
        return;
      }
      if (stopping) return;

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
  }, [wsUrl, sendWsMessage, sesionId, router, stopping]);

  useEffect(() => {
    connect();
    return () => {
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  async function handleDetener() {
    if (stopping) return;
    setStopping(true);
    sendWsMessage({ type: "stop" });
    if (wsRef.current) wsRef.current.close(1000, "user stopped");
    window.setTimeout(() => {
      router.push(`/casos/grabar/${sesionId}/revisar`);
    }, 1000);
  }

  async function handleDescartar() {
    if (stopping) return;
    setStopping(true);
    // El worker también escucha el WS — un mensaje "stop" descarta
    // el spec.ts sin guardarlo. Pero para "descartar" lo correcto es
    // pedir al server que marque la sesión como 'descartada'.
    try {
      await fetch(`/api/grabador/sesiones/${sesionId}/descartar`, {
        method: "POST",
      });
    } catch {
      /* ignore — navegamos igual */
    }
    sendWsMessage({ type: "stop" });
    if (wsRef.current) wsRef.current.close(1000, "discarded");
    router.push(`/casos`);
  }

  async function handleNavigateFromChrome(url: string) {
    // El recorder-worker no implementa navigate en V2 (codegen navega
    // directo desde su inspector bar). Por ahora, registramos el intento
    // en el spec vía ws.Send. Si en el futuro queremos manejar navigate,
    // agregamos un mensaje `navigate` a WsClientMessage y el worker lo
    // emite como `page.goto` directamente.
    sendWsMessage({ type: "navigate", url });
    setCurrentUrl(url);
  }

  const isLive = connState === "live";

  // Deriva pasos y assertions para el slot izquierdo
  const steps = useMemo(() => parseSpecToSteps(spec), [spec]);
  const kinds = useMemo<SpecLineKind[]>(
    () => steps.map((s) => s.kind),
    [steps],
  );
  const assertionCount = useMemo(
    () => steps.filter((s) => s.kind === "assertion").length,
    [steps],
  );

  return (
    <section data-testid="grabador-shell" className="flex flex-col gap-6">
      {/* Topbar + barra de URL van a borde a borde contra el `main` del
          dashboard (mismo patrón -mx-6 -mt-6 que usan otras pantallas),
          en vez de quedar encerradas en una caja con borde propio. */}
      <div className="-mx-6 -mt-6">
        <GrabadorTopbar
          titulo={titulo}
          connState={connState}
          stopping={stopping}
          onDetener={handleDetener}
          onDescartar={handleDescartar}
          startedAt={startedAt}
        />

        <BrowserChrome
          pageUrl={currentUrl}
          onNavigate={handleNavigateFromChrome}
          disabled={!isLive}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RecordingInstructions
            urlInicial={urlInicial}
            currentUrl={currentUrl}
            pasosCount={steps.length}
            assertionCount={assertionCount}
            bytes={bytes}
            connState={connState}
            errorMsg={errorMsg}
            kinds={kinds}
          />
        </div>
        <div className="lg:col-span-4">
          <RecordingGuide connState={connState} />
        </div>
      </div>

      {lastUpdateAt && (
        <div
          data-testid="grabador-last-update"
          className="-mt-3 rounded-lg bg-m3-surface-container-low px-4 py-1.5 font-mono-code text-label-sm text-m3-on-surface-variant"
        >
          Última edición del spec:{" "}
          {new Date(lastUpdateAt).toLocaleTimeString()} · sesión{" "}
          {sesionId.slice(0, 8)}…
          {startedAt && <> · iniciada {new Date(startedAt).toLocaleString()}</>}
        </div>
      )}
    </section>
  );
}
