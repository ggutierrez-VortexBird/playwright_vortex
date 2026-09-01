"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renderiza frames JPEG base64 recibidos vía custom event "grabador-frame"
 * sobre un <canvas>. El frame se pinta con requestAnimationFrame para
 * evitar tearing.
 *
 * El canvas ocupa el 100% del contenedor padre (browser stage), que en
 * la nueva layout vive dentro del "Browser Chrome" del grabador-client.
 */
export function ScreencastCanvas() {
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
      // Pintar con requestAnimationFrame para evitar tearing
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

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block object-contain bg-m3-surface-container"
      data-testid="screencast-canvas"
    />
  );
}
