"use client";

import { useState, useEffect } from "react";

/**
 * Modal para convertir un valor en parámetro (HU-G7).
 *
 * Disparado desde:
 *   - Modo señalar elemento (popover): "Convertir en parámetro"
 *   - Right-click sobre un paso existente (futuro PR)
 *
 * El modal:
 *   1. Sugiere un nombre (snake_case derivado del label)
 *   2. Muestra el valor por defecto (editable)
 *   3. Llama a `onSubmit` con el payload final
 */

export interface ConvertirParametroInput {
  nombre: string;
  valorDefecto: string;
  /** El caller puede pasar el valor actual como sugerencia. */
}

export interface ConvertirParametroModalProps {
  /** Texto del label del elemento (ej. "Username"). Se usa para sugerir el nombre. */
  elementLabel: string;
  /** Valor actual del input (si el caller lo conoce) — sirve como valor por defecto. */
  valorActual?: string | null;
  /** Sugerencia explícita del nombre (opcional). Si no, se deriva del label. */
  suggestedName?: string;
  /** Callback al confirmar. */
  onSubmit: (input: ConvertirParametroInput) => Promise<void> | void;
  /** Cancelar / cerrar modal. */
  onCancel: () => void;
  /** Mostrar spinner mientras el parent procesa. */
  busy?: boolean;
  /** Mensaje de error a mostrar. */
  errorMsg?: string | null;
}

const NOMBRE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;

function deriveSuggestedName(label: string): string {
  // snake_case from label: lowercase, replace non-alphanumeric with _.
  const cleaned = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  if (!cleaned) return "parametro";
  if (!/^[a-z]/.test(cleaned)) return `p_${cleaned}`;
  return cleaned;
}

function validateNombre(name: string): string | null {
  if (!name) return "El nombre es requerido";
  if (!NOMBRE_REGEX.test(name)) {
    return "Solo letras, dígitos y _; debe empezar con letra (1-50 chars)";
  }
  return null;
}

export function ConvertirParametroModal({
  elementLabel,
  valorActual,
  suggestedName,
  onSubmit,
  onCancel,
  busy = false,
  errorMsg = null,
}: ConvertirParametroModalProps) {
  const initialName = suggestedName ?? deriveSuggestedName(elementLabel);
  const [nombre, setNombre] = useState(initialName);
  const [valorDefecto, setValorDefecto] = useState(valorActual ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setNombre(initialName);
  }, [initialName]);

  useEffect(() => {
    setValorDefecto(valorActual ?? "");
  }, [valorActual]);

  // Close on ESC.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const nombreError = validateNombre(nombre);
  const canSubmit = !busy && !nombreError && nombre.length > 0;
  const showError = localError || errorMsg;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateNombre(nombre);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    await onSubmit({ nombre: nombre.trim(), valorDefecto });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-m3-scrim/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convertir-parametro-title"
      data-testid="convertir-parametro-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-m3-surface-container-lowest rounded-xl shadow-lg border border-m3-outline-variant overflow-hidden"
      >
        <div className="p-5 border-b border-m3-outline-variant">
          <h2
            id="convertir-parametro-title"
            className="font-headline text-headline-md text-m3-primary font-semibold"
          >
            Convertir en parámetro
          </h2>
          <p className="font-body text-body-sm text-m3-on-surface-variant mt-1">
            El valor de «{elementLabel}» podrá reutilizarse en otros casos.
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Nombre del parámetro
            </span>
            <input
              type="text"
              data-testid="parametro-nombre-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={
                nombreError
                  ? "bg-m3-surface-container-highest border border-m3-error rounded px-3 py-2 font-body text-body-md text-m3-on-surface font-mono-code"
                  : "bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface font-mono-code"
              }
              placeholder="usuario, saldo_esperado, ..."
              disabled={busy}
              autoFocus
              maxLength={50}
            />
            <span className="font-body text-body-sm text-m3-on-surface-variant">
              Se referenciará como <code>{`{{${nombre || "nombre"}}}`}</code> en el script.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Valor por defecto
            </span>
            <input
              type="text"
              data-testid="parametro-valor-input"
              value={valorDefecto}
              onChange={(e) => setValorDefecto(e.target.value)}
              className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface"
              placeholder="admin@example.com"
              disabled={busy}
            />
            <span className="font-body text-body-sm text-m3-on-surface-variant">
              Lo que se va a escribir cuando el caso se ejecute con este parámetro.
            </span>
          </label>

          {showError && (
            <p
              role="alert"
              className="text-body-sm text-m3-error bg-m3-error-container/10 border border-m3-error/30 rounded px-3 py-2"
            >
              {showError}
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
            className="px-4 py-2 bg-m3-tertiary-container text-m3-on-tertiary-container rounded font-label text-label-sm font-semibold hover:bg-m3-tertiary transition-colors disabled:opacity-50"
            data-testid="submit-button"
          >
            {busy ? "Creando…" : "Crear parámetro"}
          </button>
        </div>
      </form>
    </div>
  );
}
