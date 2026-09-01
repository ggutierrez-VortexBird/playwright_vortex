"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * Modal para agregar un paso manual (HU-G10).
 *
 * Tipos de paso soportados:
 *   - Verificación (re-usa el shape de AgregarVerificacionModal — HU-G6)
 *   - Esperar
 *   - Clic
 *   - Escribir
 *   - Navegar
 *
 * El usuario elige en qué posición (después de qué paso) insertar el nuevo.
 * El submit llama `onSubmit(payload)` con el payload a POSTear a
 * /api/grabador/sesiones/[id]/pasos.
 */

export type PasoManualTipo =
  | "verificar"
  | "esperar"
  | "clic"
  | "escribir"
  | "navegar";

export interface PasoManualInput {
  tipo: PasoManualTipo;
  descripcion: string;
  valor: string | null;
  valorEsperado: string | null;
  assertionKind: string | null;
  /** Posición: número del paso después del cual insertar (null = al final). */
  numero: number | null;
}

export interface PasoManualOption {
  id: string;
  numero: number;
  descripcion: string;
}

export interface AgregarPasoManualModalProps {
  opcionesPosicion: PasoManualOption[];
  /** Default: insert at the end (after the last paso). */
  defaultPosicion?: number | null;
  /** Default tipo: verificar. */
  defaultTipo?: PasoManualTipo;
  onSubmit: (input: PasoManualInput) => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
  errorMsg?: string | null;
}

const TIPOS: Array<{ value: PasoManualTipo; label: string; icon: string }> = [
  { value: "verificar", label: "Verificación", icon: "fact_check" },
  { value: "clic", label: "Clic", icon: "touch_app" },
  { value: "escribir", label: "Escribir", icon: "edit" },
  { value: "esperar", label: "Esperar", icon: "schedule" },
  { value: "navegar", label: "Navegar", icon: "open_in_new" },
];

const ASSERTIONS: Array<{ value: string; label: string }> = [
  { value: "visible", label: "Está visible" },
  { value: "texto_igual", label: "Texto exacto" },
  { value: "texto_contiene", label: "Texto contiene" },
  { value: "valor_igual", label: "Valor exacto (input)" },
  { value: "count", label: "Cantidad de elementos" },
];

export function AgregarPasoManualModal({
  opcionesPosicion,
  defaultPosicion,
  defaultTipo = "verificar",
  onSubmit,
  onCancel,
  busy = false,
  errorMsg = null,
}: AgregarPasoManualModalProps) {
  const [tipo, setTipo] = useState<PasoManualTipo>(defaultTipo);
  const [descripcion, setDescripcion] = useState("");
  const [valor, setValor] = useState("");
  const [valorEsperado, setValorEsperado] = useState("");
  const [assertionKind, setAssertionKind] = useState<string>("visible");
  const [posicion, setPosicion] = useState<string>(
    defaultPosicion != null ? String(defaultPosicion) : "",
  );

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Reset secondary fields when type changes.
  useEffect(() => {
    setDescripcion("");
    setValor("");
    setValorEsperado("");
    setAssertionKind("visible");
  }, [tipo]);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    switch (tipo) {
      case "verificar":
        // visible doesn't need valorEsperado; the other assertions do.
        if (assertionKind === "visible") return true;
        return valorEsperado.trim().length > 0;
      case "esperar": {
        const ms = Number.parseInt(valor, 10);
        return Number.isFinite(ms) && ms >= 0;
      }
      case "clic":
      case "escribir":
        // descripcion input acts as the selector for these types.
        return descripcion.trim().length > 0;
      case "navegar":
        // valor input acts as the URL.
        return valor.trim().length > 0;
      default:
        return false;
    }
  }, [busy, descripcion, valor, valorEsperado, assertionKind, tipo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const posicionNum = posicion === "" ? null : Number.parseInt(posicion, 10);

    // Build the descripcion if user left it empty (HU-G10 fallback).
    let finalDesc = descripcion.trim();
    if (!finalDesc) {
      finalDesc = buildDefaultDescripcion(tipo, {
        valor: valor.trim() || null,
        valorEsperado: valorEsperado.trim() || null,
        assertionKind,
      });
    }

    const needsValor =
      tipo === "escribir" || tipo === "navegar" || tipo === "esperar";
    const needsValorEsperado = tipo === "verificar";

    await onSubmit({
      tipo,
      descripcion: finalDesc,
      valor: needsValor ? valor.trim() : null,
      valorEsperado: needsValorEsperado ? valorEsperado.trim() : null,
      assertionKind: needsValorEsperado ? assertionKind : null,
      numero: posicionNum,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-m3-scrim/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agregar-paso-title"
      data-testid="agregar-paso-manual-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-m3-surface-container-lowest rounded-xl shadow-lg border border-m3-outline-variant overflow-hidden"
      >
        <div className="p-5 border-b border-m3-outline-variant">
          <h2
            id="agregar-paso-title"
            className="font-headline text-headline-md text-m3-primary font-semibold"
          >
            Agregar paso manual
          </h2>
          <p className="font-body text-body-sm text-m3-on-surface-variant mt-1">
            Insertá un paso en cualquier posición del caso.
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Tipo de paso
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5" role="radiogroup">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t.value}
                  onClick={() => setTipo(t.value)}
                  disabled={busy}
                  data-testid={`tipo-${t.value}`}
                  className={
                    tipo === t.value
                      ? "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 border-m3-primary bg-m3-primary-container text-m3-on-primary-container font-label text-label-xs font-semibold"
                      : "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-m3-outline-variant hover:bg-m3-surface-container-high font-label text-label-xs text-m3-on-surface-variant"
                  }
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </label>

          {tipo === "verificar" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-sm font-medium text-m3-on-surface">
                  Tipo de verificación
                </span>
                <select
                  data-testid="assertion-kind-select"
                  value={assertionKind}
                  onChange={(e) => setAssertionKind(e.target.value)}
                  disabled={busy}
                  className="bg-m3-surface-container-high border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
                >
                  {ASSERTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label text-label-sm font-medium text-m3-on-surface">
                  Valor esperado
                </span>
                <input
                  type="text"
                  data-testid="valor-esperado-input"
                  value={valorEsperado}
                  onChange={(e) => setValorEsperado(e.target.value)}
                  className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
                  disabled={busy}
                />
              </label>
            </>
          )}

          {(tipo === "clic" || tipo === "escribir") && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                Selector
              </span>
              <input
                type="text"
                data-testid="selector-input"
                placeholder='button[data-testid="submit"]'
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface font-mono-code"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={busy}
              />
            </label>
          )}

          {tipo === "escribir" && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                Valor a escribir
              </span>
              <input
                type="text"
                data-testid="valor-input"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
                disabled={busy}
              />
            </label>
          )}

          {tipo === "navegar" && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                URL
              </span>
              <input
                type="url"
                data-testid="url-input"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="https://example.com/login"
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
                disabled={busy}
              />
            </label>
          )}

          {tipo === "esperar" && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                Duración (ms)
              </span>
              <input
                type="number"
                data-testid="duracion-input"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                min={0}
                step={100}
                placeholder="1000"
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface font-mono-code"
                disabled={busy}
              />
            </label>
          )}

          {tipo !== "clic" && tipo !== "escribir" && tipo !== "navegar" && tipo !== "esperar" && (
            <label className="flex flex-col gap-1">
              <span className="font-label text-label-sm font-medium text-m3-on-surface">
                Descripción
              </span>
              <textarea
                data-testid="descripcion-input"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface min-h-[64px]"
                disabled={busy}
                placeholder="Describe lo que hace este paso"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Insertar después de
            </span>
            <select
              data-testid="posicion-select"
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              disabled={busy}
              className="bg-m3-surface-container-high border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
            >
              <option value="">Al final</option>
              {opcionesPosicion.map((o) => (
                <option key={o.id} value={String(o.numero)}>
                  {`Después del paso ${o.numero.toString().padStart(2, "0")} — ${o.descripcion.slice(0, 40)}`}
                </option>
              ))}
            </select>
          </label>

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
            data-testid="cancel-button"
            className="px-4 py-2 border border-m3-outline text-m3-on-surface rounded font-label text-label-sm font-medium hover:bg-m3-surface-container-high transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="submit-button"
            className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded font-label text-label-sm font-semibold hover:bg-m3-secondary-fixed transition-colors disabled:opacity-50"
          >
            {busy ? "Agregando…" : "Agregar paso"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Build a default descripcion if the user leaves it empty. */
function buildDefaultDescripcion(
  tipo: PasoManualTipo,
  ctx: { valor: string | null; valorEsperado: string | null; assertionKind: string },
): string {
  switch (tipo) {
    case "verificar":
      return `Verificar ${ctx.assertionKind}=«${ctx.valorEsperado ?? ""}»`;
    case "clic":
      return "Clic manual";
    case "escribir":
      return `Escribir «${ctx.valor ?? ""}»`;
    case "navegar":
      return `Abrir «${ctx.valor ?? ""}»`;
    case "esperar":
      return `Esperar ${ctx.valor ?? "1000"}ms`;
    default:
      return "Paso manual";
  }
}
