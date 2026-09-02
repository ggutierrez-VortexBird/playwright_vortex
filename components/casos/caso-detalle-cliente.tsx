"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ParametrosPanel, type ParametroPanelItem } from "@/components/grabador/parametros-panel";

/**
 * CasoDetalleCliente — case detail page (HU-G16 + HU-G12 + HU-G13).
 *
 * Shows the saved script + "Ejecutar" button. The full detalle con
 * ejecuciones pasadas vive en /ejecuciones/[id] (HU-4.x).
 *
 * HU-G12: panel de parámetros editable (PATCH /api/casos/[id]/parametros/[paramId]).
 *         Credenciales NO editables — sólo lectura enmascarada.
 * HU-G13: subir CSV data-driven. POST /api/casos/[id]/juego-de-datos
 *         (multipart/form-data con campo "archivo"). Las columnas del
 *         CSV deben matchear los nombres de los parametros. Preview de
 *         las primeras 5 filas se muestra tras subir.
 */

export interface CasoDetalleParametro {
  id: string;
  nombre: string;
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

export interface CasoDetalleItem {
  id: string;
  codigo: string;
  nombre: string;
  script: string;
  scriptFileName: string | null;
  origen: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  parametros: CasoDetalleParametro[];
}

export interface CasoDetalleClienteProps {
  caso: CasoDetalleItem;
  backHref: string;
}

interface PreviewRow {
  headers: string[];
  filas: Array<Record<string, string>>;
  nombreArchivo: string;
  totalFilas: number;
}

export function CasoDetalleCliente({ caso, backHref }: CasoDetalleClienteProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parametros, setParametros] = useState<ParametroPanelItem[]>(
    caso.parametros,
  );
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<PreviewRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshParametros = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/casos/${encodeURIComponent(caso.id)}/parametros`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { parametros: ParametroPanelItem[] };
      setParametros(data.parametros);
    } catch {
      // ignore — la UI sigue mostrando el último estado conocido.
    }
  }, [caso.id]);

  async function handleEjecutar() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/casos/${encodeURIComponent(caso.id)}/ejecutar`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setErrorMsg(data.message ?? data.error ?? `Ejecutar falló (${res.status})`);
        return;
      }
      const data = (await res.json()) as { ejecucionId: string };
      window.location.href = `/ejecuciones/${data.ejecucionId}`;
    } catch {
      setErrorMsg("Error de red al ejecutar");
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvUpload(file: File) {
    setCsvBusy(true);
    setCsvError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const res = await fetch(
        `/api/casos/${encodeURIComponent(caso.id)}/juego-de-datos`,
        { method: "POST", body: fd },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        errors?: Array<{ column?: string; message: string }>;
        headers?: string[];
        previewRows?: Array<Record<string, string>>;
        juego?: { nombreArchivo: string };
      };
      if (!res.ok) {
        const msg =
          data.message ??
          (data.errors && data.errors.length > 0
            ? data.errors.map((e) => e.message).join("; ")
            : `Subir falló (${res.status})`);
        setCsvError(msg);
        return;
      }
      setCsvPreview({
        headers: data.headers ?? [],
        filas: data.previewRows ?? [],
        nombreArchivo: data.juego?.nombreArchivo ?? file.name,
        totalFilas: (data.previewRows ?? []).length,
      });
    } catch {
      setCsvError("Error de red al subir CSV");
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="caso-detalle-cliente">
      <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-lg shadow-sm">
        <div className="p-5 border-b border-m3-outline-variant flex justify-between items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <Link
              href={backHref}
              className="font-label text-label-sm text-m3-on-surface-variant hover:text-m3-primary"
              data-testid="back-link"
            >
              ← Volver
            </Link>
            <h2 className="font-headline text-headline-lg text-m3-primary font-semibold mt-2">
              {caso.nombre}
            </h2>
            <p className="font-mono-code text-xs text-m3-on-surface-variant mt-1">
              {caso.codigo} · origen: {caso.origen}
              {caso.scriptFileName ? ` · ${caso.scriptFileName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleEjecutar}
            disabled={busy}
            data-testid="ejecutar-button"
            className="px-4 py-2 bg-m3-primary text-m3-on-primary rounded font-label text-label-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {busy ? "Encolando…" : "Ejecutar"}
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            data-testid="caso-detalle-error"
            className="px-5 py-3 border-b border-m3-error/30 bg-m3-error-container/10 text-m3-error font-body text-body-sm"
          >
            {errorMsg}
          </div>
        )}

        <div className="p-5">
          <h3 className="font-headline text-headline-md text-m3-primary tracking-wide mb-2">
            SCRIPT GENERADO
          </h3>
          <pre
            data-testid="script-block"
            className="bg-m3-surface-container rounded p-4 overflow-x-auto font-mono-code text-mono-code text-m3-on-surface whitespace-pre text-xs"
          >
            {caso.script}
          </pre>
        </div>

        {parametros.length > 0 && (
          <div className="p-5 border-t border-m3-outline-variant">
            <ParametrosPanel
              parametros={parametros}
              readOnly={false}
              casoPruebaId={caso.id}
              onParametrosChange={refreshParametros}
              emptyMessage="Sin parámetros definidos."
            />
          </div>
        )}

        {/* HU-G13 — Juego de datos (CSV data-driven) */}
        <div
          className="p-5 border-t border-m3-outline-variant"
          data-testid="csv-section"
        >
          <h3 className="font-headline text-headline-md text-m3-primary tracking-wide mb-2">
            JUEGO DE DATOS (CSV)
          </h3>
          <p className="font-body text-body-sm text-m3-on-surface-variant mb-3">
            Subí un CSV con una fila por escenario. Las columnas deben
            coincidir con los nombres de los parámetros (header obligatorio).
            Al ejecutar, el caso corre 1 vez por fila.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              data-testid="csv-file-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={csvBusy}
              data-testid="csv-upload-button"
              className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded font-label text-label-sm font-medium hover:bg-m3-secondary-fixed transition-colors disabled:opacity-50 shadow-sm"
            >
              {csvBusy ? "Subiendo…" : "Subir CSV"}
            </button>
            {csvPreview && (
              <button
                type="button"
                onClick={() => {
                  setCsvPreview(null);
                  setCsvError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                data-testid="csv-clear-button"
                className="px-3 py-2 text-m3-on-surface-variant hover:text-m3-primary font-label text-label-sm"
              >
                Quitar
              </button>
            )}
          </div>
          {csvError && (
            <div
              role="alert"
              data-testid="csv-error"
              className="mt-3 px-3 py-2 border border-m3-error/30 bg-m3-error-container/10 text-m3-error font-body text-body-sm rounded"
            >
              {csvError}
            </div>
          )}
          {csvPreview && (
            <div
              className="mt-4"
              data-testid="csv-preview"
            >
              <p className="font-label text-label-sm text-m3-on-surface-variant mb-2">
                {csvPreview.nombreArchivo} · primeras {csvPreview.filas.length}{" "}
                de {csvPreview.totalFilas} filas mostradas
              </p>
              <div className="overflow-x-auto border border-m3-outline-variant rounded">
                <table className="w-full text-body-sm font-mono-code">
                  <thead className="bg-m3-surface-container">
                    <tr>
                      {csvPreview.headers.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-semibold text-m3-on-surface border-b border-m3-outline-variant"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.filas.map((fila, idx) => (
                      <tr key={idx} className="border-b border-m3-outline-variant/50">
                        {csvPreview.headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-1.5 text-m3-on-surface whitespace-nowrap"
                          >
                            {fila[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
