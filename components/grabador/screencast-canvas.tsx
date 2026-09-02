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
   * a coordenadas internas de la pagina (que es lo que CDP/Playwright
   * esperan — viewport 1280x720).
   *
   * BUG FIX: el CSS `object-contain` deja bandas vacias (letterbox)
   * arriba/abajo o a los lados si el aspect ratio del container no
   * matchea el del contenido. La version anterior no las tenia en
   * cuenta, asi que clicks en el letterbox se mapeaban a coordenadas
   * fuera del viewport real y el browser los descartaba.
   *
   * Calculamos el bounding box VISUAL del contenido dentro del canvas
   * element y mapeamos solo si el click cae dentro de esa zona.
   */
  const eventToPageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      if (canvas.width === 0 || canvas.height === 0) return null;

      // Calculamos el area visual real del contenido dentro del canvas
      // element (object-contain centra y deja bandas si hay mismatch).
      const containerAspect = rect.width / rect.height;
      const contentAspect = canvas.width / canvas.height;

      let visualW: number;
      let visualH: number;
      let offsetX: number;
      let offsetY: number;
      if (contentAspect > containerAspect) {
        // contenido mas ancho → bandas arriba/abajo
        visualW = rect.width;
        visualH = rect.width / contentAspect;
        offsetX = 0;
        offsetY = (rect.height - visualH) / 2;
      } else {
        // contenido mas alto → bandas a los lados
        visualH = rect.height;
        visualW = rect.height * contentAspect;
        offsetX = (rect.width - visualW) / 2;
        offsetY = 0;
      }

      const cssX = clientX - rect.left - offsetX;
      const cssY = clientY - rect.top - offsetY;
      // Si el click cae en el letterbox, no hay nada debajo.
      if (cssX < 0 || cssY < 0 || cssX > visualW || cssY > visualH) {
        return null;
      }
      return {
        x: Math.round((cssX / visualW) * canvas.width),
        y: Math.round((cssY / visualH) * canvas.height),
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
    const coords = eventToPageCoords(e.clientX, e.clientY);
    if (!coords) return; // click en letterbox — ignorar
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    pressedButtonsRef.current.add(e.button);
    sendInput({
      type: "mouse_down",
      x: coords.x,
      y: coords.y,
      button,
      clickCount: 1,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    e.preventDefault();
    const coords = eventToPageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    pressedButtonsRef.current.delete(e.button);
    sendInput({
      type: "mouse_up",
      x: coords.x,
      y: coords.y,
      button,
      clickCount: 1,
    });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    const coords = eventToPageCoords(e.clientX, e.clientY);
    if (!coords) return;
    sendInput({ type: "mouse_move", x: coords.x, y: coords.y });
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    if (inputDisabled) return;
    e.preventDefault();
    const coords = eventToPageCoords(e.clientX, e.clientY);
    if (!coords) return;
    sendInput({
      type: "wheel",
      x: coords.x,
      y: coords.y,
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

    // Para caracteres imprimibles (letras, numeros, simbolos sin
    // modificadores), usamos `type` que internamente dispara
    // keydown + keypress + input en un solo mensaje. NO mandamos
    // tambien key_down porque duplicaria el evento en el browser.
    const printable =
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (printable) {
      sendInput({ type: "type", text: e.key });
    } else {
      // Teclas especiales (Enter, Escape, Tab, Arrow keys, F1-F12)
      // van como key_down para que el worker haga page.keyboard.down(key).
      const modifiers = computeModifiers(e);
      sendInput({
        type: "key_down",
        key: e.key,
        code: e.code,
        modifiers,
      });
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
