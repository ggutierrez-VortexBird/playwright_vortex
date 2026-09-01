"use client";

import { useEffect, useState } from "react";

/**
 * usePasosEnVivo — live `paso_agregado` subscription for the recorder panel.
 *
 * HU-G3: el recorder-worker hace broadcast `paso_agregado` por cada paso
 * persistido. La conexión WS ya está abierta por grabador-client (la API
 * del recorder usa tokens one-shot, así que NO podemos abrir un segundo
 * WS desde acá). En lugar de eso, grabador-client dispara un
 * `CustomEvent('grabador-paso', { detail: paso })` por cada mensaje
 * `paso_agregado`, y este hook se suscribe a esos eventos.
 *
 * Decisión de diseño (HU-GR-3): el window-event pattern evita duplicar
 * la conexión WS y mantiene el flujo "una sola fuente de verdad" para
 * el estado de pasos. Si en el futuro queremos multi-cliente desde
 * la misma página, cambiamos a un Context o passthrough del WS.
 *
 * @param sessionId - referencia de la sesión (reservado para multi-session
 *   routing futuro; actualmente el hook recibe eventos de cualquier
 *   sesión que dispare eventos — solo hay una en esta página).
 * @param initialPasos - pasos precargados del server (initial render).
 * @returns lista de pasos; crece cuando llegan eventos nuevos.
 */

export interface PasoEnVivo {
  id: string;
  numero: number;
  tipo: string;
  descripcion: string;
  valor: string | null;
  esValorSensible: boolean;
  parametroNombre: string | null;
  createdAt: string;
}

/** Nombre del evento window que disparará grabador-client. */
export const PASO_AGREGADO_EVENT = "grabador-paso" as const;

/** Tipo del payload del evento. Coincide con el `paso_agregado` del WS server. */
export interface PasoAgregadoDetail extends PasoEnVivo {
  /** sessionId a la que pertenece el paso. El hook lo ignora en este PR. */
  sesionId?: string;
}

function isPasoAgregadoDetail(value: unknown): value is PasoAgregadoDetail {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.numero === "number" &&
    typeof v.tipo === "string" &&
    typeof v.descripcion === "string" &&
    typeof v.createdAt === "string"
  );
}

export function usePasosEnVivo(
  sessionId: string,
  initialPasos: PasoEnVivo[] = [],
): PasoEnVivo[] {
  const [pasos, setPasos] = useState<PasoEnVivo[]>(initialPasos);

  // Sync local state when the parent passes a fresh `initialPasos`
  // (e.g. when navigating to a different session).
  useEffect(() => {
    setPasos(initialPasos);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) return;

    function onPasoAgregado(ev: Event): void {
      const ce = ev as CustomEvent<PasoAgregadoDetail>;
      const detail = ce.detail;
      if (!isPasoAgregadoDetail(detail)) return;
      if (detail.sesionId && detail.sesionId !== sessionId) return;
      setPasos((prev) => {
        // Dedupe by id (defense against double-broadcast).
        if (prev.some((p) => p.id === detail.id)) return prev;
        return [...prev, detail];
      });
    }

    window.addEventListener(PASO_AGREGADO_EVENT, onPasoAgregado);
    return () => {
      window.removeEventListener(PASO_AGREGADO_EVENT, onPasoAgregado);
    };
  }, [sessionId]);

  return pasos;
}
