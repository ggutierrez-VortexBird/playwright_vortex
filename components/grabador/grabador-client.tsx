"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WsServerMessage, WsClientMessage } from "@/lib/recorder/types";
import type { SerializedElementFull } from "@/lib/grabador/dom-utils";
import { ScreencastCanvas } from "./screencast-canvas";
import { ConnectionStatus } from "./connection-status";
import { PasoPanel } from "./paso-panel";
import { RecToolbar } from "./rec-toolbar";
import { GrabadorTopbar, type GrabadorTopbarMeta } from "./grabador-topbar";
import { AgregarVerificacionModal, type AssertionKind } from "./agregar-verificacion-modal";

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
        } else if (msg.type === "highlight") {
          // HU-G5: hover sobre el canvas con signal mode activo. Worker
          // devuelve el bbox del elemento bajo el cursor para que
          // dibujemos el overlay rojo.
          setHighlightBbox(msg.bbox);
        } else if (msg.type === "pick_result") {
          // HU-G5: usuario hizo click sobre un elemento con signal mode
          // activo. Worker devuelve el elemento serializado + aria snapshot
          // (para HU-G6 tipo 'snapshot'). Mostramos el popover.
          if (msg.element) {
            setPickedElement({
              element: msg.element,
              ariaSnapshot: msg.ariaSnapshot,
            });
          } else {
            // pick falló — limpiar estado
            setPickedElement(null);
            setHighlightBbox(null);
          }
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

  // HU-G5 — signal mode state.
  // `pickedElement` se setea cuando llega un {type:'pick_result', element}
  // desde el worker. Mostraremos un popover con 3 acciones:
  // agregar verificación / convertir a parámetro / snapshot.
  const [pickedElement, setPickedElement] = useState<{
    element: SerializedElementFull;
    ariaSnapshot: string | null;
  } | null>(null);
  // `highlightBbox` se setea cuando llega un {type:'highlight', bbox}.
  // El canvas dibuja un overlay rojo sobre este bbox.
  const [highlightBbox, setHighlightBbox] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);
  // `showVerificacionModal` — abrir el modal de assert.
  // `defaultAssertion` pre-selecciona el tipo cuando el usuario eligio
  // 'snapshot' desde el popover (HU-G6 tipo 'snapshot').
  const [showVerificacionModal, setShowVerificacionModal] = useState(false);
  const [defaultAssertion, setDefaultAssertion] = useState<AssertionKind>("visible");

  function handleToggleSignal() {
    setSignalActive((prev) => {
      const next = !prev;
      // Limpiar estado relacionado al togglear off.
      if (!next) {
        setHighlightBbox(null);
        setPickedElement(null);
      }
      return next;
    });
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
    // Si el popover esta activo, abrir el modal. Si no, mostrar hint.
    if (pickedElement) {
      setDefaultAssertion("visible");
      setShowVerificacionModal(true);
      return;
    }
    setErrorMsg(
      "Elegí un elemento del navegador para agregar una verificación.",
    );
  }

  /**
 * HU-G5 — popover position calculator.
 *
 * Bug: cuando el elemento pickeado esta muy a la derecha o muy abajo,
 * el popover (260px ancho, ~250px alto) se desbordaba del canvas del
 * navegador contenido y quedaba parcialmente invisible.
 *
 * Fix: posicionamiento relativo al bbox del elemento con flip inteligente
 * segun la orientacion:
 *   - Si el elemento esta en la mitad derecha del viewport: flip horizontal
 *     (popover aparece a la IZQUIERDA del elemento).
 *   - Si el elemento esta en la mitad inferior: flip vertical
 *     (popover aparece ARRIBA del elemento).
 *   - En caso contrario: default (a la derecha y abajo del elemento).
 *
 * Tamaños aproximados del popover (min-w=260, alto variable segun
 * acciones pero acotado a ~250). Usamos esos limites para calcular
 * el flip antes de pintar; si por algun motivo el popover es mas
 * grande, igualmente queda dentro del canvas porque el padre tiene
 * `overflow-hidden` y los porcentajes se mantienen.
 */
function computePopoverPosition(bbox: {
  x: number;
  y: number;
  width: number;
  height: number;
} | null): { left: string; top: string } {
  // Fallback: esquina superior izquierda del canvas.
  if (!bbox) return { left: "0%", top: "0%" };

  // Constantes del viewport del page (las mismas que el browser).
  // El canvas CSS escala via object-contain, asi que los porcentajes
  // se calculan contra estas constantes.
  const PAGE_W = 1280;
  const PAGE_H = 720;
  // Dimensiones aproximadas del popover (clamp para flip).
  const POPOVER_W = 280;
  const POPOVER_H = 260;
  // Offset entre el elemento y el popover.
  const GAP = 8;

  const elemCenterX = bbox.x + bbox.width / 2;
  const elemBottomY = bbox.y + bbox.height;
  const elemTopY = bbox.y;

  // ── Horizontal ─────────────────────────────────────────────────────
  // Si el elemento esta en la mitad derecha O no hay espacio a la
  // derecha (popover no entraria), flip a la izquierda.
  const preferRight = elemCenterX + POPOVER_W + GAP <= PAGE_W;
  const preferLeft = bbox.x - POPOVER_W - GAP >= 0;
  let leftPx: number;
  if (preferRight) {
    // popover a la derecha del elemento (gap horizontal)
    leftPx = bbox.x + bbox.width + GAP;
    if (leftPx + POPOVER_W > PAGE_W) {
      // No entra -> flip
      leftPx = bbox.x - POPOVER_W - GAP;
      if (leftPx < 0) leftPx = 0; // clamp
    }
  } else if (preferLeft) {
    leftPx = bbox.x - POPOVER_W - GAP;
    if (leftPx < 0) leftPx = 0;
  } else {
    // No entra ni a derecha ni a izquierda: posicionamos lo mas a
    // la derecha posible (clamp) — el padre tiene overflow-hidden
    // asi que el popover queda visible aunque el elemento este en
    // el medio.
    leftPx = Math.max(0, PAGE_W - POPOVER_W);
  }

  // ── Vertical ───────────────────────────────────────────────────────
  // Default: debajo del elemento. Si no entra, flip arriba.
  const preferBelow = elemBottomY + POPOVER_H + GAP <= PAGE_H;
  const preferAbove = elemTopY - POPOVER_H - GAP >= 0;
  let topPx: number;
  if (preferBelow) {
    topPx = elemBottomY + GAP;
  } else if (preferAbove) {
    topPx = elemTopY - POPOVER_H - GAP;
    if (topPx < 0) topPx = 0;
  } else {
    topPx = Math.max(0, PAGE_H - POPOVER_H);
  }

  return {
    left: `${(leftPx / PAGE_W) * 100}%`,
    top: `${(topPx / PAGE_H) * 100}%`,
  };
}



  /**
   * HU-G6: submit del modal de verificacion. POSTea un PasoGrabado de tipo
   * 'verificar' con el selector, assertionKind y valor (texto para
   * text/value/count, YAML del aria tree para 'snapshot').
   */
  async function handleSubmitVerificacion(input: {
    assertionKind: AssertionKind;
    valorEsperado: string;
  }) {
    if (!pickedElement) return;
    setBusy("detener"); // reusar el lock para deshabilitar botones
    try {
      const el = pickedElement.element;
      const best = el.candidates.find((c) => c.strategy !== "css") ?? el.candidates[0];
      const selectorPrincipal = {
        tag: el.tag,
        text: el.text || null,
        aria: el.aria || null,
        testId: el.testId || null,
      };
      const selectoresRespaldo = el.candidates.map((c) => ({
        strategy: c.strategy,
        value: c.value,
      }));
      const descripcion =
        input.assertionKind === "snapshot"
          ? `Verificar snapshot de «${el.text || el.aria || el.tag}»`
          : input.assertionKind === "visible"
            ? `Verificar que «${el.text || el.aria || el.tag}» está visible`
            : input.assertionKind === "count"
              ? `Verificar que «${el.text || el.aria || el.tag}» aparezca ${input.valorEsperado} ${input.valorEsperado === "1" ? "vez" : "veces"}`
              : input.assertionKind === "texto_igual"
                ? `Verificar que el texto de «${el.text || el.aria || el.tag}» sea exactamente «${input.valorEsperado}»`
                : input.assertionKind === "texto_contiene"
                  ? `Verificar que el texto de «${el.text || el.aria || el.tag}» contenga «${input.valorEsperado}»`
                  : `Verificar que el valor de «${el.text || el.aria || el.tag}» sea «${input.valorEsperado}»`;
      const res = await fetch(
        `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/pasos`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tipo: "verificar",
            origen: "grabado",
            descripcion,
            selectorPrincipal,
            selectoresRespaldo,
            valor: input.valorEsperado || null,
            assertionKind: input.assertionKind,
            // Para 'snapshot' guardamos el selector del best candidate
            // como `selectorEstrategado` extra para que el codegen lo use.
            ...(best ? { selectorEstrategado: best } : {}),
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setErrorMsg(data.message ?? `Error creando verificación (${res.status})`);
        return;
      }
      // La API route no broadcastea paso_agregado por WS (corre en otro
      // proceso). Para que el PasoPanel muestre el assert al instante
      // durante la grabacion, dispatch local del window event que
      // usePasosEnVivo escucha. Asi el paso aparece al costado derecho
      // inmediatamente al confirmar el modal.
      const data = (await res.json()) as {
        paso?: {
          id: string;
          numero: number;
          tipo: string;
          descripcion: string;
          valor: string | null;
          esValorSensible: boolean;
          assertionKind?: string | null;
          createdAt?: string | Date;
        };
      };
      if (data.paso) {
        const p = data.paso;
        window.dispatchEvent(
          new CustomEvent("grabador-paso", {
            detail: {
              id: p.id,
              numero: p.numero,
              tipo: p.tipo,
              descripcion: p.descripcion,
              valor: p.valor,
              esValorSensible: p.esValorSensible,
              parametroNombre: null,
              createdAt:
                typeof p.createdAt === "string"
                  ? p.createdAt
                  : (p.createdAt as Date).toISOString(),
              sesionId,
            },
          }),
        );
      }
      // Cerrar popover + modal.
      setShowVerificacionModal(false);
      setPickedElement(null);
      setHighlightBbox(null);
    } catch (err) {
      setErrorMsg(`Error de red: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
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
                signalActive={signalActive}
                onHover={(coords) => {
                  // HU-G5: throttle con 50ms via React (suficiente).
                  // El componente canvas ya hace su propio debounce; acá
                  // solo forward al WS.
                  if (!signalActive) return;
                  sendWsMessage({ type: "hover", x: coords.x, y: coords.y });
                }}
                onPick={(coords) => {
                  if (!signalActive) return;
                  sendWsMessage({ type: "pick", x: coords.x, y: coords.y });
                }}
              />
              {!isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-m3-surface-container/80 backdrop-blur-sm">
                  <ConnectionStatus state={connState} mode="inline" />
                </div>
              )}

              {/* HU-G5: highlight overlay sobre el canvas. Se posiciona
                  en coordenadas del viewport (las mismas que el worker
                  devuelve en el bbox, que ya esta en coords del page
                  viewport 1280x720). El CSS del canvas padre con
                  object-contain se encarga del escalado visual. */}
              {signalActive && highlightBbox && (
                <div
                  aria-hidden="true"
                  data-testid="signal-highlight"
                  className="absolute pointer-events-none border-2 border-error rounded-sm shadow-[0_0_0_2px_rgba(255,0,0,0.3)]"
                  style={{
                    left: `${(highlightBbox.x / 1280) * 100}%`,
                    top: `${(highlightBbox.y / 720) * 100}%`,
                    width: `${(highlightBbox.width / 1280) * 100}%`,
                    height: `${(highlightBbox.height / 720) * 100}%`,
                  }}
                />
              )}

{/* HU-G5: popover con opciones para el elemento pickeado.
                  Posicionado con flip inteligente (computePopoverPosition):
                  si el elemento esta muy a la derecha, el popover
                  aparece a la IZQUIERDA; si esta muy abajo, aparece
                  ARRIBA. Asi nunca se desborda del canvas del navegador.

                  Solo los 4 tools de Playwright (pick locator, assert
                  visibility, assert text, assert snapshot). Sin
                  "Convertir en parametro" — eso NO es de Playwright. */}
              {signalActive && pickedElement && (
                <div
                  data-testid="signal-popover"
                  className="absolute z-30 bg-m3-surface-container-highest border border-m3-outline-variant rounded-lg shadow-lg p-2 flex flex-col gap-1 min-w-[260px] max-w-[320px]"
                  style={computePopoverPosition(pickedElement.element.bbox)}
                >
                  <div className="font-label text-label-sm text-m3-on-surface-variant px-2 py-1 truncate max-w-[300px]">
                    «{pickedElement.element.text || pickedElement.element.aria || pickedElement.element.tag}»
                  </div>
                  <div className="border-t border-m3-outline-variant/50 my-1" />

                  {/* 1. Pick locator — volver a pickear */}
                  <button
                    type="button"
                    data-testid="popover-action-pick"
                    onClick={() => {
                      setPickedElement(null);
                      setHighlightBbox(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-m3-surface-container text-m3-on-surface font-body text-body-sm text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">touch_app</span>
                    Pick locator (cambiar selección)
                  </button>

                  {/* 2. Assert visibility */}
                  <button
                    type="button"
                    data-testid="popover-action-assert-visible"
                    onClick={() => {
                      setDefaultAssertion("visible");
                      setShowVerificacionModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-m3-surface-container text-m3-on-surface font-body text-body-sm text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Assert visibility
                  </button>

                  {/* 3. Assert text */}
                  <button
                    type="button"
                    data-testid="popover-action-assert-text"
                    onClick={() => {
                      setDefaultAssertion("texto_igual");
                      setShowVerificacionModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-m3-surface-container text-m3-on-surface font-body text-body-sm text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">title</span>
                    Assert text
                  </button>

                  {/* 4. Assert snapshot */}
                  <button
                    type="button"
                    data-testid="popover-action-assert-snapshot"
                    onClick={() => {
                      if (!pickedElement.ariaSnapshot) {
                        setErrorMsg(
                          "No se pudo capturar el snapshot (elemento sin selector estable u oculto).",
                        );
                        return;
                      }
                      setDefaultAssertion("snapshot");
                      setShowVerificacionModal(true);
                    }}
                    disabled={!pickedElement.ariaSnapshot}
                    className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-m3-surface-container text-m3-on-surface font-body text-body-sm text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    Assert snapshot (a11y)
                  </button>
                </div>
              )}
            </div>

            <RecToolbar
              disabled={!isLive}
              signalActive={signalActive}
              paused={paused}
              onToggleSignal={handleToggleSignal}
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

      {/* HU-G5/G6 modal: agregar verificación / snapshot. */}
      {showVerificacionModal && pickedElement && (
        <AgregarVerificacionModal
          elementLabel={
            pickedElement.element.text ||
            pickedElement.element.aria ||
            pickedElement.element.tag
          }
          origen="grabado"
          sesionId={sesionId}
          ariaSnapshot={pickedElement.ariaSnapshot}
          initialAssertion={defaultAssertion}
          onCancel={() => {
            setShowVerificacionModal(false);
            setPickedElement(null);
            setHighlightBbox(null);
          }}
          onSubmit={handleSubmitVerificacion}
          // defaultAssertion se aplica via key — remontamos cuando cambia
          key={defaultAssertion}
        />
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
