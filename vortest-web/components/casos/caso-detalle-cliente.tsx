"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ParametrosPanel, type ParametroPanelItem } from "@/components/grabador/parametros-panel";
import { configureVortestEditor, VORTEST_DARK_THEME } from "@/lib/recorder/monaco-setup";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { OrigenChip } from "@/components/ejecuciones/origen-chip";
import { useBreadcrumbExtra } from "@/components/breadcrumb-context";

// Monaco toca `window`/`navigator` al cargar — se difiere al cliente para
// no romper el render del servidor de esta pantalla.
const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-m3-on-surface-variant font-body text-body-sm">
      Cargando editor…
    </div>
  ),
});

/**
 * CasoDetalleCliente — case detail page (HU-G16 + HU-G12).
 *
 * Shows the saved script + "Ejecutar" button. The full detalle con
 * ejecuciones pasadas vive en /ejecuciones/[id] (HU-4.x).
 *
 * HU-G12: panel de parámetros editable (PATCH /api/casos/[id]/parametros/[paramId]).
 *         Credenciales NO editables — sólo lectura enmascarada.
 */

function formatBytes(chars: number): string {
  if (chars === 0) return "0 B";
  const kb = chars / 1024;
  if (kb < 1) return `${chars} B`;
  return `${kb.toFixed(1)} KB`;
}

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
  /** Abre el editor de script ya desplegado al montar — llega desde la
   *  acción "Script" de la tabla de Casos (?editarScript=1). */
  autoAbrirEditorScript?: boolean;
}

export function CasoDetalleCliente({
  caso,
  backHref,
  autoAbrirEditorScript = false,
}: CasoDetalleClienteProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parametros, setParametros] = useState<ParametroPanelItem[]>(
    caso.parametros,
  );

  const { setExtra } = useBreadcrumbExtra();
  useEffect(() => {
    setExtra([{ label: "Script" }, { label: caso.nombre }]);
    return () => setExtra([]);
  }, [caso.nombre, setExtra]);

  // Editor del script — separado del formulario "Editar" (nombre, código,
  // responsable) que vive en la tabla de Casos. Este edita el .spec.ts en
  // sí, con un editor de verdad (Monaco), no solo reemplazar el archivo.
  const [script, setScript] = useState(caso.script);
  const [editingScript, setEditingScript] = useState(autoAbrirEditorScript);
  const [scriptDraft, setScriptDraft] = useState(caso.script);
  const [savingScript, setSavingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  function handleEditarScript() {
    setScriptDraft(script);
    setScriptError(null);
    setEditingScript(true);
  }

  function handleCancelarScript() {
    setEditingScript(false);
    setScriptError(null);
    setScriptDraft(script);
  }

  async function handleGuardarScript() {
    if (savingScript) return;
    if (!scriptDraft.trim()) {
      setScriptError("El script no puede quedar vacío");
      return;
    }
    setSavingScript(true);
    setScriptError(null);
    try {
      const fd = new FormData();
      fd.append("script", scriptDraft);
      const res = await fetch(`/api/casos/${encodeURIComponent(caso.id)}`, {
        method: "PUT",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        script?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setScriptError(
          data.message ?? data.error ?? `No se pudo guardar (HTTP ${res.status})`,
        );
        return;
      }
      setScript(data.script ?? scriptDraft);
      setEditingScript(false);
    } catch {
      setScriptError("Error de conexión al guardar el script");
    } finally {
      setSavingScript(false);
    }
  }

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
      <PageHeader
        title={caso.nombre}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-m3-surface-container-high px-1.5 py-0.5 font-mono-code text-[11px] text-m3-on-surface-variant">
              {caso.codigo}
            </span>
            <OrigenChip origen={caso.origen} />
            {caso.scriptFileName && (
              <span className="rounded bg-m3-surface-container-high px-1.5 py-0.5 font-mono-code text-[11px] text-m3-on-surface-variant">
                {caso.scriptFileName}
              </span>
            )}
          </div>
        }
        actions={
          <Button
            variant="primary"
            onClick={handleEjecutar}
            disabled={busy}
            data-testid="ejecutar-button"
            className="inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {busy ? "Encolando…" : "Ejecutar"}
          </Button>
        }
      />
      <Link href={backHref} className="sr-only" data-testid="back-link">
        ← Volver
      </Link>

      <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-lg shadow-sm">
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
          <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
            <h3 className="font-headline text-headline-md text-m3-primary tracking-wide">
              SCRIPT GENERADO
            </h3>
            {editingScript ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelarScript}
                  disabled={savingScript}
                  data-testid="cancelar-script-button"
                  className="px-3 py-1.5 rounded font-label text-label-sm text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarScript}
                  disabled={savingScript}
                  data-testid="guardar-script-button"
                  className="px-3 py-1.5 rounded font-label text-label-sm font-semibold bg-m3-primary text-m3-on-primary hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                >
                  {savingScript ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEditarScript}
                data-testid="editar-script-button"
                title="Editar el script de Playwright"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded font-label text-label-sm font-medium text-m3-on-surface-variant border border-m3-outline-variant hover:bg-m3-surface-container-high hover:text-m3-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  terminal
                </span>
                Editar script
              </button>
            )}
          </div>

          {scriptError && (
            <div
              role="alert"
              data-testid="script-error"
              className="mb-3 px-3 py-2 border border-m3-error/30 bg-m3-error-container/10 text-m3-error font-body text-body-sm rounded"
            >
              {scriptError}
            </div>
          )}

          <div
            data-testid="script-editor-container"
            className="flex h-[380px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow-xl lg:h-[440px]"
          >
            {/* Titlebar + tab del archivo — mismo tratamiento que el editor del grabador */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0b1120] px-3 py-2">
              <div className="flex items-center gap-2 rounded-t-md border-t-2 border-blue-500 bg-[#0f172a] px-3 py-1.5 font-mono-code text-xs text-slate-200 shadow">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-[9px] font-bold text-white">
                  TS
                </span>
                <span className="font-medium">{caso.scriptFileName ?? `${caso.codigo}.spec.ts`}</span>
                <span className="ml-1 text-[10px] text-slate-500">
                  {formatBytes((editingScript ? scriptDraft : script).length)}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                theme={VORTEST_DARK_THEME}
                value={editingScript ? scriptDraft : script}
                onChange={(value) => editingScript && setScriptDraft(value ?? "")}
                beforeMount={configureVortestEditor}
                options={{
                  readOnly: !editingScript,
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Statusbar */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-[#0b1120] px-4 py-1.5 font-mono-code text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${editingScript ? "bg-amber-400" : "bg-emerald-400"}`} />
                {editingScript ? "Editando" : "Solo lectura"}
              </span>
              <span className="text-slate-500">Playwright Test Runner</span>
            </div>
          </div>
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
