"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ParametrosPanel, type ParametroPanelItem } from "@/components/grabador/parametros-panel";

/**
 * CasoDetalleCliente — case detail page (HU-G16 redirect target + HU-G12).
 *
 * Shows the saved script in a pre block + a "Ejecutar" button. The full
 * detalle con ejecuciones pasadas vive en /ejecuciones/[id] (HU-4.x).
 *
 * HU-G12: el panel de parámetros es editable (PATCH /api/casos/[id]/parametros/[paramId]).
 * Credenciales NO se pueden editar desde acá — sólo lectura enmascarada.
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

export function CasoDetalleCliente({ caso, backHref }: CasoDetalleClienteProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parametros, setParametros] = useState<ParametroPanelItem[]>(
    caso.parametros,
  );

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
      </div>
    </div>
  );
}
