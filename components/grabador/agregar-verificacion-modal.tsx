"use client";

import { useState, useEffect } from "react";

/**
 * Modal para crear un paso de verificación (HU-G6).
 *
 * Tipos de assertion soportados (orden de aparición):
 *   - visible (default)
 *   - texto_igual
 *   - texto_contiene
 *   - valor_igual
 *   - count
 *
 * El modal se cierra al hacer submit exitoso o al cancelar. La
 * responsabilidad de crear el paso es de la página padre (recibe
 * `onSubmit(payload)`).
 *
 * Reusado desde:
 *   - Modo señalar elemento (popover) — pass elementLabel computed upstream
 *   - Pantalla Revisar (HU-G10) — pass the same elementLabel
 */

export type AssertionKind =
  | "visible"
  | "texto_igual"
  | "texto_contiene"
  | "valor_igual"
  | "count"
  /** HU-G6 snapshot: `expect(locator).toMatchAriaSnapshot(yaml)`.
   *  El YAML se captura en pick time (lo trae pick_result.ariaSnapshot)
   *  y NO requiere valorEsperado. */
  | "snapshot";

export interface AgregarVerificacionInput {
  /** Tipo de assertion. Default "visible". */
  assertionKind: AssertionKind;
  /** Valor esperado (texto/número) — vacío para `visible` y `snapshot`. */
  valorEsperado: string;
}

export interface AgregarVerificacionModalProps {
  /** Texto del label del elemento (ej. «Submit», «Username»). */
  elementLabel: string;
  /** Origen del paso — 'grabado' o 'manual'. */
  origen: "grabado" | "manual";
  /** Selector JSON — se persiste tal cual en PasoGrabado.selectorPrincipal. */
  selectorPrincipal?: unknown;
  /** Selectores respaldo — se persiste tal cual en PasoGrabado.selectoresRespaldo. */
  selectoresRespaldo?: unknown;
  /** Sesion ID — el parent puede reusar este para construir el payload. */
  sesionId: string;
  /** Snapshot YAML pre-capturado (HU-G6 tipo 'snapshot'). Si es null y
   *  el usuario elige 'snapshot', el botón submit queda disabled. */
  ariaSnapshot?: string | null;
  /** Assertion inicial seleccionado. Default "visible". */
  initialAssertion?: AssertionKind;
  /** Callback al confirmar — recibe el payload a POSTear. */
  onSubmit: (input: AgregarVerificacionInput) => Promise<void> | void;
  /** Cancelar / cerrar modal. */
  onCancel: () => void;
  /** Mostrar spinner mientras el parent procesa. */
  busy?: boolean;
  /** Mensaje de error a mostrar (server-side validation, etc). */
  errorMsg?: string | null;
}

const ASSERTIONS: Array<{ value: AssertionKind; label: string; needsValor: boolean; needsSnapshot?: boolean }> = [
  { value: "visible", label: "Está visible", needsValor: false },
  { value: "texto_igual", label: "Texto exacto", needsValor: true },
  { value: "texto_contiene", label: "Texto contiene", needsValor: true },
  { value: "valor_igual", label: "Valor (input) exacto", needsValor: true },
  { value: "count", label: "Cantidad de elementos", needsValor: true },
  { value: "snapshot", label: "Snapshot (accessibility tree)", needsValor: false, needsSnapshot: true },
];

export function AgregarVerificacionModal({
  elementLabel,
  onSubmit,
  onCancel,
  busy = false,
  errorMsg = null,
  ariaSnapshot = null,
  initialAssertion = "visible",
}: AgregarVerificacionModalProps) {
  const [assertionKind, setAssertionKind] = useState<AssertionKind>(initialAssertion);
  const [valorEsperado, setValorEsperado] = useState("");

  // Reset valorEsperado when assertion changes to one that doesn't need it.
  useEffect(() => {
    if (assertionKind === "visible" || assertionKind === "snapshot") {
      setValorEsperado("");
    }
  }, [assertionKind]);

  // Close on ESC.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const needsValor = assertionKind !== "visible" && assertionKind !== "snapshot";
  const needsSnapshot = assertionKind === "snapshot";
  const canSubmit =
    !busy &&
    (!needsValor || valorEsperado.trim().length > 0) &&
    (!needsSnapshot || (typeof ariaSnapshot === "string" && ariaSnapshot.trim().length > 0));

  function buildDescripcion(): string {
    switch (assertionKind) {
      case "visible":
        return `Verificar que «${elementLabel}» está visible`;
      case "texto_igual":
        return `Verificar que el texto de «${elementLabel}» sea exactamente «${valorEsperado}»`;
      case "texto_contiene":
        return `Verificar que el texto de «${elementLabel}» contenga «${valorEsperado}»`;
      case "valor_igual":
        return `Verificar que el valor de «${elementLabel}» sea «${valorEsperado}»`;
      case "count":
        return `Verificar que «${elementLabel}» aparezca ${valorEsperado} ${valorEsperado === "1" ? "vez" : "veces"}`;
      case "snapshot":
        return `Verificar snapshot de «${elementLabel}» (accessibility tree)`;
      default:
        return `Verificar «${elementLabel}»`;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // Para snapshot, mandamos el YAML como "valor" para que el serializer
    // lo use como contenido de toMatchAriaSnapshot(...).
    const finalValor = needsSnapshot
      ? (ariaSnapshot ?? "")
      : needsValor
        ? valorEsperado
        : "";
    await onSubmit({ assertionKind, valorEsperado: finalValor });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-m3-scrim/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agregar-verificacion-title"
      data-testid="agregar-verificacion-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-m3-surface-container-lowest rounded-xl shadow-lg border border-m3-outline-variant overflow-hidden"
      >
        <div className="p-5 border-b border-m3-outline-variant">
          <h2
            id="agregar-verificacion-title"
            className="font-headline text-headline-md text-m3-primary font-semibold"
          >
            Agregar verificación
          </h2>
          <p className="font-body text-body-sm text-m3-on-surface-variant mt-1">
            Sobre «{elementLabel}»
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Tipo de verificación
            </span>
            <select
              data-testid="assertion-kind-select"
              className="bg-m3-surface-container-high border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
              value={assertionKind}
              onChange={(e) => setAssertionKind(e.target.value as AssertionKind)}
              disabled={busy}
            >
              {ASSERTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          {needsValor && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                Valor esperado
                {assertionKind === "count" ? " (entero)" : ""}
              </span>
              <input
                type={assertionKind === "count" ? "number" : "text"}
                data-testid="valor-esperado-input"
                value={valorEsperado}
                onChange={(e) => setValorEsperado(e.target.value)}
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
                placeholder={
                  assertionKind === "count" ? "1" : "Texto o valor esperado"
                }
                disabled={busy}
                min={assertionKind === "count" ? 1 : undefined}
              />
            </label>
          )}

          {/* Preview the descripcion that will be saved. */}
          <div className="bg-m3-surface-container rounded p-3 border border-m3-outline-variant">
            <span className="font-label text-[11px] uppercase tracking-wider text-m3-on-surface-variant block mb-1">
              Vista previa del paso
            </span>
            <span
              className="font-body text-body-md text-m3-on-surface"
              data-testid="descripcion-preview"
            >
              {buildDescripcion()}
            </span>
          </div>

          {/* Snapshot preview — solo cuando el assertionKind es 'snapshot'. */}
          {needsSnapshot && (
            <div className="bg-m3-surface-container rounded p-3 border border-m3-outline-variant">
              <span className="font-label text-[11px] uppercase tracking-wider text-m3-on-surface-variant block mb-1">
                Snapshot YAML (aria tree)
              </span>
              {ariaSnapshot && ariaSnapshot.trim().length > 0 ? (
                <pre
                  data-testid="snapshot-preview"
                  className="font-mono-code text-mono-code text-m3-on-surface text-xs bg-m3-surface-container-highest rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
                >
                  {ariaSnapshot}
                </pre>
              ) : (
                <p className="text-body-sm text-m3-error">
                  No se pudo capturar el snapshot. El elemento podría estar oculto o tener un selector inestable.
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <p
              role="alert"
              className="text-body-sm text-m3-error bg-m3-error-container/10 border border-m3-error/30 rounded px-3 py-2"
            >
              {errorMsg}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-m3-outline-variant flex justify-end gap-2 bg-m3-surface-container-lowest">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-m3-outline text-m3-on-surface rounded font-label text-label-sm font-medium hover:bg-m3-surface-container-high transition-colors disabled:opacity-50"
            data-testid="cancel-button"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded font-label text-label-sm font-semibold hover:bg-m3-secondary-fixed transition-colors disabled:opacity-50"
            data-testid="submit-button"
          >
            {busy ? "Guardando…" : "Agregar verificación"}
          </button>
        </div>
      </form>
    </div>
  );
}
