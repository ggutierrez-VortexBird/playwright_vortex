"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * CasoDetalleCliente — minimal case detail page (HU-G16 redirect target).
 *
 * Shows the saved script in a pre block + a "Ejecutar" button. The full
 * detalle con ejecuciones pasadas vive en /ejecuciones/[id] (HU-4.x);
 * esta página es solo el "primer pantallazo" post-guardar.
 */

export interface CasoDetalleParametro {
  id: string;
  nombre: string;
  valorDefecto: string | null;
  origen: string;
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

export function CasoDetalleCliente({ caso, backHref }: CasoDetalleClienteProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

        {caso.parametros.length > 0 && (
          <div className="p-5 border-t border-m3-outline-variant">
            <h3 className="font-headline text-headline-md text-m3-primary tracking-wide mb-2">
              PARÁMETROS
            </h3>
            <ul className="flex flex-col gap-2">
              {caso.parametros.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 text-body-sm"
                >
                  <span className="font-mono-code bg-m3-tertiary-container text-m3-on-tertiary-container px-1.5 py-0.5 rounded text-xs">
                    {`{{${p.nombre}}}`}
                  </span>
                  <span className="text-m3-on-surface-variant truncate">
                    {p.origen === "credencial" ? "••••" : p.valorDefecto ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
