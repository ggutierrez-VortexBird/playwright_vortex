"use client";

import { useState, useEffect } from "react";

/**
 * Modal para editar un PasoGrabado existente (HU-G9).
 *
 * Disparado desde el botón de edición en cada paso de la pantalla
 * Revisar. Permite modificar:
 *   - descripcion (textarea)
 *   - selectorPrincipal (textarea pretty-printed JSON)
 *   - valor (text input)
 *
 * Si el paso tiene un valor que contiene {{nombre}} y existe un
 * ParametroGrabacion con ese nombre, mostramos un checkbox para
 * "Actualizar default del parámetro".
 *
 * El submit llama a `onSave(payload)` con los campos actualizados.
 */

export interface EditarPasoInput {
  descripcion: string;
  selectorPrincipal: unknown | null;
  valor: string | null;
  actualizarDefaultParametro: boolean;
}

export interface EditarPasoModalProps {
  pasoId: string;
  numero: number;
  descripcionInicial: string;
  selectorPrincipalInicial: unknown | null;
  valorInicial: string | null;
  /** Nombres de parámetros conocidos en la sesión (para detectar {{nombre}} en el valor). */
  parametrosConocidos: string[];
  onSave: (input: EditarPasoInput) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
  errorMsg?: string | null;
}

function stringifySelectorJson(selector: unknown): string {
  if (selector == null) return "";
  if (typeof selector === "string") return selector;
  try {
    return JSON.stringify(selector, null, 2);
  } catch {
    return "";
  }
}

function parseSelectorJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "JSON inválido",
    };
  }
}

export function EditarPasoModal({
  pasoId,
  numero,
  descripcionInicial,
  selectorPrincipalInicial,
  valorInicial,
  parametrosConocidos,
  onSave,
  onDelete,
  onCancel,
  busy = false,
  errorMsg = null,
}: EditarPasoModalProps) {
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [selectorText, setSelectorText] = useState(
    stringifySelectorJson(selectorPrincipalInicial),
  );
  const [valor, setValor] = useState(valorInicial ?? "");
  const [actualizarDefault, setActualizarDefault] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setDescripcion(descripcionInicial);
  }, [descripcionInicial]);
  useEffect(() => {
    setSelectorText(stringifySelectorJson(selectorPrincipalInicial));
  }, [selectorPrincipalInicial]);
  useEffect(() => {
    setValor(valorInicial ?? "");
  }, [valorInicial]);

  // ESC to close.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const selectorParsed = parseSelectorJson(selectorText);
  const canSubmit =
    !busy &&
    descripcion.trim().length > 0 &&
    (selectorText.trim().length === 0 || selectorParsed.ok);

  // Detect {{nombre}} references in current valor/descripcion to suggest
  // the "actualizar default" checkbox.
  const allText = `${valor} ${descripcion}`;
  const linkedParams = parametrosConocidos.filter((n) =>
    allText.includes(`{{${n}}}`),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const selectorFinal = selectorParsed.ok ? selectorParsed.value : null;
    await onSave({
      descripcion: descripcion.trim(),
      selectorPrincipal: selectorFinal,
      valor: valor.length > 0 ? valor : null,
      actualizarDefaultParametro: actualizarDefault,
    });
  }

  async function handleDelete() {
    await onDelete();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-m3-scrim/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-paso-title"
      data-testid="editar-paso-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-m3-surface-container-lowest rounded-xl shadow-lg border border-m3-outline-variant overflow-hidden"
      >
        <div className="p-5 border-b border-m3-outline-variant flex justify-between items-start gap-3">
          <div>
            <h2
              id="editar-paso-title"
              className="font-headline text-headline-md text-m3-primary font-semibold"
            >
              Editar paso {numero.toString().padStart(2, "0")}
            </h2>
            <p className="font-body text-body-sm text-m3-on-surface-variant mt-1">
              Ajustá la descripción, el selector o el valor.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className="text-m3-on-surface-variant hover:text-m3-primary"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
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
              maxLength={500}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Selector (JSON)
            </span>
            <textarea
              data-testid="selector-input"
              value={selectorText}
              onChange={(e) => setSelectorText(e.target.value)}
              className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-mono-code text-body-sm text-m3-on-surface min-h-[64px]"
              placeholder='{ "tag": "button", "testId": "submit" }'
              disabled={busy}
              spellCheck={false}
            />
            {!selectorParsed.ok && (
              <span className="font-body text-body-sm text-m3-error">
                JSON inválido: {selectorParsed.error}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-label-sm font-medium text-m3-on-surface">
              Valor
            </span>
            <input
              type="text"
              data-testid="valor-input"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="bg-m3-surface-container-highest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface font-mono-code"
              disabled={busy}
              placeholder="Texto o {{parametro}}"
            />
          </label>

          {linkedParams.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid="actualizar-default-checkbox"
                checked={actualizarDefault}
                onChange={(e) => setActualizarDefault(e.target.checked)}
                disabled={busy}
                className="w-4 h-4"
              />
              <span className="font-body text-body-md text-m3-on-surface">
                Actualizar default del parámetro ({linkedParams.map((p) => `{{${p}}}`).join(", ")})
              </span>
            </label>
          )}

          {/* Hidden pasoId used by tests + parent to avoid magic strings. */}
          <input type="hidden" data-testid="paso-id-hidden" value={pasoId} />

          {errorMsg && (
            <p
              role="alert"
              className="text-body-sm text-m3-error bg-m3-error-container/10 border border-m3-error/30 rounded px-3 py-2"
            >
              {errorMsg}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-m3-outline-variant flex justify-between items-center gap-2 bg-m3-surface-container-lowest">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2" data-testid="delete-confirm-row">
                <span className="font-body text-body-sm text-m3-error">
                  ¿Eliminar definitivamente?
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={busy}
                  className="px-3 py-1.5 border border-m3-outline rounded font-label text-label-sm"
                  data-testid="delete-cancel"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="px-3 py-1.5 bg-m3-error text-m3-on-error rounded font-label text-label-sm font-medium"
                  data-testid="delete-confirm"
                >
                  {busy ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={busy}
                className="px-3 py-2 border border-m3-error/50 text-m3-error rounded font-label text-label-sm font-medium hover:bg-m3-error-container/10"
                data-testid="delete-button"
              >
                <span className="material-symbols-outlined text-[16px] mr-1 align-middle">
                  delete
                </span>
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
              data-testid="save-button"
            >
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
