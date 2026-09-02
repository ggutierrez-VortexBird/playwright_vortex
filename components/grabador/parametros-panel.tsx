"use client";

/**
 * ParametrosPanel — lista los ParametroGrabacion con su valor por defecto.
 *
 * HU-G12 (editable) + HU-G7 (visualización):
 *   - Muestra el chip `{{nombre}}`, origen, valor por defecto y badges.
 *   - "Sin uso" cuando enUso=false (badge amarillo).
 *   - Edición inline del valor por defecto para params manuales.
 *   - Credenciales: enmascaradas y NO editables.
 *
 * Modos de operación:
 *   - `readOnly` (default true): sólo renderiza, sin handlers de edición.
 *   - `casoPruebaId` requerido cuando editable, para enrutar el PATCH.
 *   - `onParametrosChange` opcional: callback para refrescar el padre.
 *
 * Reusado desde:
 *   - <RevisarCliente> (HU-G8, modo lectura)
 *   - <CasoDetalleCliente> (HU-G16, modo edición)
 */

import { useState, useTransition } from "react";

export interface ParametroPanelItem {
  id: string;
  nombre: string;
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

export interface ParametrosPanelProps {
  parametros: ParametroPanelItem[];
  /** Mensaje cuando no hay parámetros. */
  emptyMessage?: string;
  /** Si true (default), los parametros manuales se pueden editar inline. */
  readOnly?: boolean;
  /** casoPruebaId — requerido si readOnly=false, para enrutar PATCH. */
  casoPruebaId?: string;
  /** Callback opcional tras un PATCH exitoso (refresca lista). */
  onParametrosChange?: () => void;
}

export function ParametrosPanel({
  parametros,
  emptyMessage = "Todavía no convertiste ningún valor en parámetro.",
  readOnly = true,
  casoPruebaId,
  onParametrosChange,
}: ParametrosPanelProps) {
  return (
    <div
      className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm flex flex-col overflow-hidden"
      data-testid="parametros-panel"
    >
      <div className="p-5 border-b border-m3-outline-variant bg-m3-surface-container-lowest flex justify-between items-center gap-3">
        <h3 className="font-headline text-headline-md text-m3-primary tracking-wide">
          PARÁMETROS
        </h3>
        <span className="font-label text-xs text-m3-on-surface-variant bg-m3-surface-container-high px-2.5 py-1 rounded-full">
          {parametros.length} {parametros.length === 1 ? "parámetro" : "parámetros"}
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
        data-testid="parametros-panel-body"
      >
        {parametros.length === 0 ? (
          <div
            className="py-4 flex items-center justify-center border-2 border-dashed border-m3-outline-variant/50 rounded-lg text-m3-on-surface-variant bg-m3-surface-container-lowest"
            data-testid="parametros-empty"
          >
            <span className="text-sm text-center px-4">{emptyMessage}</span>
          </div>
        ) : (
          parametros.map((p) => (
            <ParametroRow
              key={p.id}
              parametro={p}
              readOnly={readOnly}
              casoPruebaId={casoPruebaId}
              onSaved={onParametrosChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ParametroRowProps {
  parametro: ParametroPanelItem;
  readOnly: boolean;
  casoPruebaId?: string;
  onSaved?: () => void;
}

function ParametroRow({
  parametro,
  readOnly,
  casoPruebaId,
  onSaved,
}: ParametroRowProps) {
  const isCredencial = parametro.origen === "credencial";
  const isSensitive = isCredencial;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parametro.valorDefecto ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const valorDisplay = isSensitive
    ? maskValue(parametro.valorDefecto ?? "")
    : parametro.valorDefecto;

  const canEdit = !readOnly && !isCredencial && Boolean(casoPruebaId);

  async function handleSave() {
    if (!casoPruebaId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/casos/${encodeURIComponent(casoPruebaId)}/parametros/${encodeURIComponent(parametro.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ valorDefecto: draft.length > 0 ? draft : null }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? `Guardar falló (${res.status})`);
        return;
      }
      setEditing(false);
      startTransition(() => {
        onSaved?.();
      });
    } catch {
      setError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex items-start gap-3 bg-m3-surface-container px-3 py-2 rounded-lg"
      data-testid={`parametro-row-${parametro.nombre}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono-code text-xs bg-m3-tertiary-container text-m3-on-tertiary-container px-1.5 py-0.5 rounded"
              data-testid={`parametro-chip-${parametro.nombre}`}
            >
              {`{{${parametro.nombre}}}`}
            </span>
            {isCredencial && (
              <span className="font-label text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-m3-secondary-container text-m3-on-secondary-container">
                credencial
              </span>
            )}
            {!parametro.enUso && (
              <span
                className="font-label text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-m3-tertiary-container text-m3-on-tertiary-container"
                data-testid={`parametro-sin-uso-${parametro.nombre}`}
                title="Ningún paso actual usa este parámetro"
              >
                sin uso
              </span>
            )}
            {parametro.enUso && (
              <span
                className="material-symbols-outlined text-[14px] text-m3-primary"
                title="En uso en el caso"
                aria-label="En uso"
                data-testid="parametro-en-uso"
              >
                check_circle
              </span>
            )}
          </div>

        {editing ? (
          <div className="mt-2 flex flex-col gap-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              data-testid={`parametro-input-${parametro.nombre}`}
              className="w-full bg-m3-surface-container-lowest border border-m3-outline rounded px-2 py-1 text-body-sm font-mono-code focus:outline-none focus:border-m3-primary"
              aria-label={`Editar valor de {{${parametro.nombre}}}`}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-testid={`parametro-save-${parametro.nombre}`}
                className="px-2 py-1 bg-m3-primary text-m3-on-primary rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(parametro.valorDefecto ?? "");
                  setError(null);
                }}
                disabled={saving}
                data-testid={`parametro-cancel-${parametro.nombre}`}
                className="px-2 py-1 border border-m3-outline text-m3-on-surface rounded text-xs font-medium hover:bg-m3-surface-container-high disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
            {error && (
              <div
                role="alert"
                data-testid={`parametro-error-${parametro.nombre}`}
                className="text-xs text-m3-error"
              >
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <span className="font-body text-body-sm text-m3-on-surface-variant truncate flex-1 min-w-0">
              {valorDisplay == null || valorDisplay === ""
                ? "—"
                : valorDisplay}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid={`parametro-edit-${parametro.nombre}`}
                className="text-xs text-m3-primary hover:underline font-medium"
                aria-label={`Editar {{${parametro.nombre}}}`}
              >
                Editar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mask the value like a credit card: show last 4 digits only. */
function maskValue(v: string): string {
  if (v.length === 0) return "—";
  if (v.length <= 4) return "•".repeat(v.length);
  return "•".repeat(Math.max(0, v.length - 4)) + v.slice(-4);
}