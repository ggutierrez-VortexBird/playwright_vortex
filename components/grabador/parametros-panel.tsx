/**
 * ParametrosPanel — V2 minimal stub.
 *
 * En V1 este panel permitía editar parámetros creados durante la grabación
 * (HU-G12: cookies, credenciales, etc.). V2 (pivot playwright-codegen) no
 * crea parámetros automáticamente — el spec crudo de `playwright codegen`
 * no tiene `const params = {...}`. Si un caso se subió con un script
 * paramétrico, los params viven en el script directamente; este panel
 * muestra los params extraídos del caso desde la DB (CasoParametros).
 *
 * Para no romper la pantalla /casos/[id], este componente es read-only:
 * muestra el nombre y valor de cada param. La edición de params en V2
 * requiere editar el script .spec.ts directamente.
 */
"use client";

import { useState, useTransition } from "react";

export interface ParametroPanelItem {
  id: string;
  nombre: string;
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

interface ParametrosPanelProps {
  casoPruebaId: string;
  parametros: ParametroPanelItem[];
  readOnly?: boolean;
  onParametrosChange?: () => Promise<void> | void;
  emptyMessage?: string;
  /** @deprecated V2: el panel es read-only — se ignora. */
  onUpdated?: (parametros: ParametroPanelItem[]) => void;
}

/**
 * Reproduce el mask de credenciales que tenía el serializarPasos de V1.
 * 7 bullets + últimos 4 chars. Las credenciales reales NO se muestran en la UI.
 */
function maskValue(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  const last4 = value.slice(-4);
  const bullets = "•".repeat(Math.min(7, value.length - 4));
  return `${bullets}${last4}`;
}

export function ParametrosPanel({ parametros, emptyMessage }: ParametrosPanelProps) {
  const [items] = useState<ParametroPanelItem[]>(parametros);
  const [, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-6 text-center text-m3-on-surface-variant">
        <p className="text-sm">
          {emptyMessage ?? "Este caso no tiene parámetros."}
        </p>
        <p className="mt-2 text-xs text-m3-on-surface">
          V2: los parámetros se editan directamente en el
          archivo <code>.spec.ts</code> del caso.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm overflow-hidden">
      <table className="w-full font-body text-body-sm">
        <thead className="bg-m3-surface-container text-m3-on-surface-variant">
          <tr>
            <th className="px-3 py-2 text-left font-label text-label-sm uppercase tracking-wide">
              Nombre
            </th>
            <th className="px-3 py-2 text-left font-label text-label-sm uppercase tracking-wide">
              Valor por defecto
            </th>
            <th className="px-3 py-2 text-left font-label text-label-sm uppercase tracking-wide">
              Origen
            </th>
          </tr>
        </thead>
        <tbody data-testid="parametros-panel-body">
          {items.map((p) => {
            const isSensitive =
              p.origen === "credencial" ||
              /password|secret|token|key/i.test(p.nombre);
            return (
              <tr key={p.id} className="border-t border-m3-outline-variant">
                <td className="px-3 py-2 font-mono-code text-xs">
                  <span className="rounded bg-m3-surface-container-high px-1.5 py-0.5 text-[11px] text-m3-on-surface">
                    {`{{${p.nombre}}}`}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.valorDefecto === null ? (
                    <span className="text-m3-on-surface">—</span>
                  ) : isSensitive ? (
                    maskValue(p.valorDefecto)
                  ) : (
                    p.valorDefecto
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{p.origen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
