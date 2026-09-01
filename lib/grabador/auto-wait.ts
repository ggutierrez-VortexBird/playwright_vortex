/**
 * Auto-wait detection (HU-G4).
 *
 * Cuando el browser emite eventos DOM (click, input, etc.) con un gap
 * superior a WAIT_THRESHOLD_MS entre uno y el siguiente, el grabador
 * persiste un paso intermedio de tipo "esperar" para que el script
 * generado respete ese tiempo (importante para flujos con delays del
 * servidor, animaciones, etc.).
 *
 * Esta función es pura: toma dos timestamps y devuelve el evento de
 * wait a persistir, o `null` si el gap está por debajo del umbral.
 *
 * La PAUSA manual (botón "Pausar") se maneja en HU-G7 y es OUT OF SCOPE
 * acá — solo se detecta la espera implícita por inactividad de eventos.
 */

import type { EventoDom } from "./translator";

/** Umbral en ms para considerar un gap como "espera automática".
 *  >300ms es suficiente para evitar inflar el panel con ruido, pero
 *  suficientemente bajo para capturar delays reales de UI/server. */
export const WAIT_THRESHOLD_MS = 300;

/**
 * Devuelve un evento `wait` cuando `deltaMs` supera el umbral, o `null`
 * si el gap es despreciable (probable ruido entre eventos consecutivos).
 *
 * El delta cero (evento siguiente inmediato) se trata como no-wait para
 * no contaminar el panel con pasos vacíos al iniciar la sesión.
 */
export function detectarAutoWait(
  prevTimestamp: number | null,
  currTimestamp: number,
  thresholdMs: number = WAIT_THRESHOLD_MS,
): EventoDom | null {
  if (prevTimestamp === null) {
    // Primer evento de la sesion — no hay "gap previo" que registrar.
    return null;
  }
  const deltaMs = currTimestamp - prevTimestamp;
  if (deltaMs <= thresholdMs) {
    return null;
  }
  return {
    type: "wait",
    target: null,
    value: null,
    timestamp: currTimestamp,
    deltaFromPreviousMs: deltaMs,
  };
}
