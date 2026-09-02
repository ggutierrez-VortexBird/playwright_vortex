"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WsClientMessage } from "@/lib/recorder/types";

/**
 * Renderiza frames JPEG base64 recibidos vía custom event "grabador-frame"
 * sobre un <canvas>. El frame se pinta con requestAnimationFrame para
 * evitar tearing.
 *
 * Tambien captura pointer/wheel/keyboard events sobre el canvas y los
 * reenvia al browser via callback `onInputEvent`. El padre (grabador-client)
 * lo cablea al WS que va al recorder-worker → CDP Input.dispatchMouseEvent /
 * Input.dispatchKeyEvent → la pagina procesa el input nativamente → sus
 * DOM listeners disparan → __pw_report (init-script) emite el paso → DB.
 *
 * Esto es lo que hace `npx playwright codegen <url>` por debajo.
 *
 * El canvas ocupa el 100% del contenedor padre (browser stage), que en
 * la nueva layout vive dentro del "Browser Chrome" del grabador-client.
 */
export interface ScreencastCanvasProps {
  /** Callback que envia mensajes al recorder-worker via WS. */
  onInputEvent?: (msg: WsClientMessage) => void;
  /** Deshabilita la captura de input (e.g. cuando el senal mode esta activo,
   *  los clicks se manejan en otra capa). */
  inputDisabled?: boolean;
}

export function ScreencastCanvas({
  onInputEvent,
  inputDisabled = false,
}: ScreencastCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameData, setFrameData] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ data: string }>).detail;
      setFrameData(detail.data);
    }
    window.addEventListener("grabador-frame", handler);
    return () => {
      window.removeEventListener("grabador-frame", handler);
    };
  }, []);

  useEffect(() => {
    if (!frameData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      });
    };
    img.src = `data:image/jpeg;base64,${frameData}`;

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [frameData]);

  /**
   * Convierte coordenadas del click (CSS pixels del canvas renderizado)
   * a coordenadas internas de la pagina (que es lo que CDP espera).
   *
   * El canvas renderiza la pagina a su tamano intrinseco (1280x720 por
   * defecto del browser); el CSS scalea visualmente via object-contain.
   * El factor de escala es canvasIntrinsicW / canvasRenderedW.
   */
  const eventToPageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: clientX, y: clientY };
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { x: clientX, y: clientY };
      }
      // CSS pixel offset relative to canvas.
      const cssX = clientX - rect.left;
      const cssY = clientY - rect.top;
      // Scale to internal canvas coordinates (= page viewport coords).
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: Math.round(cssX * scaleX),
        y: Math.round(cssY * scaleY),
      };
    },
    [],
  );

  const sendInput = useCallback(
    (msg: WsClientMessage) => {
      if (inputDisabled) return;
      onInputEvent?.(msg);
    },
    [inputDisabled, onInputEvent],
  );

  // Track which buttons are pressed to emit proper down/up sequences.
  const pressedButtonsRef = useRef<Set<number>>(new Set());

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    e.preventDefault();
    canvasRef.current?.focus();
    const { x, y } = eventToPageCoords(e.clientX, e.clientY);
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    pressedButtonsRef.current.add(e.button);
    sendInput({
      type: "mouse_down",
      x,
      y,
      button,
      clickCount: e.detail,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    e.preventDefault();
    const { x, y } = eventToPageCoords(e.clientX, e.clientY);
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    pressedButtonsRef.current.delete(e.button);
    sendInput({
      type: "mouse_up",
      x,
      y,
      button,
      clickCount: e.detail,
    });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    // Throttle mouse_move (CDP doesn't need every pixel)
    const { x, y } = eventToPageCoords(e.clientX, e.clientY);
    sendInput({ type: "mouse_move", x, y });
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    e.preventDefault();
    const { x, y } = eventToPageCoords(e.clientX, e.clientY);
    sendInput({
      type: "wheel",
      x,
      y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    // Solo capturamos si el canvas tiene foco (evita capturar cuando
    // el usuario escribe en otros inputs del dashboard).
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const modifiers = computeModifiers(e);
    sendInput({
      type: "key_down",
      key: e.key,
      code: e.code,
      modifiers,
    });
    // Para caracteres imprimibles, dispatch también type para que llene
    // inputs de una sola pasada (Input.insertText es más robusto que
    // simular keypress por char).
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      sendInput({ type: "type", text: e.key });
    }
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const modifiers = computeModifiers(e);
    sendInput({
      type: "key_up",
      key: e.key,
      code: e.code,
      modifiers,
    });
  }

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className="w-full h-full block object-contain bg-m3-surface-container cursor-crosshair outline-none focus:ring-2 focus:ring-m3-secondary"
      data-testid="screencast-canvas"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

function computeModifiers(e: React.KeyboardEvent | React.MouseEvent): number {
  let m = 0;
  if (e.altKey) m |= 1;
  if (e.ctrlKey) m |= 2;
  if (e.metaKey) m |= 4;
  if (e.shiftKey) m |= 8;
  return m;
}
