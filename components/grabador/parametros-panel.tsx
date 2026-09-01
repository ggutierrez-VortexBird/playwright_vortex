"use client";

/**
 * ParametrosPanel — lista los ParametroGrabacion de la sesión con su
 * valor por defecto.
 *
 * Reusado desde:
 *   - PasoPanel lateral (futuro PR, dentro del grabador)
 *   - RevisarCliente pantalla (HU-G8)
 *
 * Solo lectura en PR-3. La edición de parámetros (HU-G12) llega en PR-5.
 *
 * Cada fila muestra:
 *   - nombre del parámetro en chip `{{nombre}}` (mono-code)
 *   - chip "credencial" si origen='credencial' (badge lila)
 *   - valor por defecto (masked si esValorSensible)
 *   - ícono de estado: lock si está en uso (enUso=true)
 */

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
}

export function ParametrosPanel({
  parametros,
  emptyMessage = "Todavía no convertiste ningún valor en parámetro.",
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
          parametros.map((p) => <ParametroRow key={p.id} parametro={p} />)
        )}
      </div>
    </div>
  );
}

function ParametroRow({ parametro }: { parametro: ParametroPanelItem }) {
  const isCredencial = parametro.origen === "credencial";
  const isSensitive = isCredencial; // credenciales siempre enmascaradas
  const valorDisplay =
    parametro.valorDefecto == null
      ? "—"
      : isSensitive
        ? maskValue(parametro.valorDefecto)
        : parametro.valorDefecto;

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
        <div className="font-body text-body-sm text-m3-on-surface-variant mt-1 truncate">
          {valorDisplay}
        </div>
      </div>
    </div>
  );
}

/** Mask the value like a credit card: show last 4 digits only. */
function maskValue(v: string): string {
  if (v.length <= 4) return "•".repeat(v.length);
  return "•".repeat(Math.max(0, v.length - 4)) + v.slice(-4);
}
