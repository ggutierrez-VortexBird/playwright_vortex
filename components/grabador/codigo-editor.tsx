"use client";

/**
 * CodigoEditor — HU-G11 MVP.
 *
 * Wrapper de @monaco-editor/react que muestra el `.spec.ts` generado por
 * el serializer (`serializarPasos`). MVP:
 *   - Read-only por defecto.
 *   - Toggle "Editar" habilita edición.
 *   - Botón "Guardar" persiste en el CasoPrueba (PUT /api/casos/[id]
 *     con FormData). Sólo se muestra cuando `casoPruebaId` está set
 *     (es decir, cuando ya se guardó el caso desde la pantalla Revisar).
 *
 * El "parser inverse" (re-generar pasos a partir de un .spec.ts editado)
 * está fuera del scope de este MVP — el ACTA lo deja para HU-G11 next.
 *
 * Implementación:
 *   - Carga Monaco de forma lazy en useEffect (client-only) para evitar
 *     SSR (Monaco no tiene SSR-friendly export). Esto también facilita
 *     testing en jsdom (no usamos next/dynamic, que es async).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { OnMount } from "@monaco-editor/react";

export interface CodigoEditorProps {
  /** Script generado por serializarPasos (read-only display + edit). */
  scriptInicial: string;
  /** casoPruebaId — si está, habilita "Guardar". */
  casoPruebaId: string | null;
  /** Nombre del archivo .spec.ts sugerido para PUT. */
  scriptFileName?: string;
  /** Callback opcional al guardar OK (para refrescar UI padre). */
  onSaved?: () => void;
}

// Tipo de la prop `Editor` de @monaco-editor/react. No la importamos en
// top-level para no arrastrar Monaco al bundle inicial.
type MonacoEditorComponent = React.ComponentType<{
  value: string;
  onChange?: (v: string | undefined) => void;
  onMount?: OnMount;
  options?: Record<string, unknown>;
  height?: string | number;
  defaultLanguage?: string;
  theme?: string;
}>;

export function CodigoEditor({
  scriptInicial,
  casoPruebaId,
  scriptFileName,
  onSaved,
}: CodigoEditorProps) {
  const [editable, setEditable] = useState(false);
  const [contenido, setContenido] = useState(scriptInicial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [EditorComp, setEditorComp] = useState<MonacoEditorComponent | null>(
    null,
  );
  // Para que los tests (que mockean @monaco-editor/react) también
  // funcionen, exponemos una API imperativa via window.__monacoForTest
  // cuando se mockea. El useEffect a continuación lo resuelve.
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Lazy-load Monaco en cliente.
  useEffect(() => {
    let alive = true;
    void import("@monaco-editor/react")
      .then((m) => {
        if (alive) setEditorComp(() => m.Editor);
      })
      .catch(() => {
        /* Monaco no carga (offline) — se mostrará fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    // Asegurar wrap y minmap off para mejor UX en pantallas chicas.
    try {
      editor.updateOptions({ wordWrap: "on", minimap: { enabled: false } });
    } catch {
      /* noop */
    }
  }, []);

  function handleChange(value: string | undefined) {
    const next = value ?? "";
    setContenido(next);
    setDirty(next !== scriptInicial);
    setOkMsg(null);
  }

  async function handleSave() {
    if (!casoPruebaId) return;
    setBusy(true);
    setErrorMsg(null);
    setOkMsg(null);
    try {
      const fd = new FormData();
      // Wrappeamos el contenido como un archivo .spec.ts — el endpoint
      // PUT /api/casos/[id] espera FormData con un campo "scriptFile".
      const blob = new Blob([contenido], { type: "text/typescript" });
      const filename = scriptFileName ?? "caso.spec.ts";
      fd.append("scriptFile", blob, filename);

      const res = await fetch(
        `/api/casos/${encodeURIComponent(casoPruebaId)}`,
        {
          method: "PUT",
          body: fd,
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setErrorMsg(data.message ?? `Guardar falló (${res.status})`);
        return;
      }
      setDirty(false);
      setOkMsg("Script guardado correctamente.");
      if (onSaved) onSaved();
    } catch {
      setErrorMsg("Error de red al guardar");
    } finally {
      setBusy(false);
    }
  }

  const canSave = Boolean(casoPruebaId) && dirty && !busy;

  return (
    <div className="flex flex-col gap-3" data-testid="codigo-editor">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-label text-label-sm text-gray-500 uppercase tracking-wider">
            {scriptFileName ?? "caso.spec.ts"}
          </span>
          {dirty && (
            <span
              className="text-xs text-amber-600 font-medium"
              data-testid="codigo-editor-dirty"
            >
              · sin guardar
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              data-testid="codigo-editor-toggle-edit"
              checked={editable}
              onChange={(e) => setEditable(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Editar
          </label>
          {casoPruebaId ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="codigo-editor-save"
              className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Guardando…" : "Guardar script"}
            </button>
          ) : (
            <span
              className="text-xs text-gray-500 italic"
              data-testid="codigo-editor-no-save-hint"
            >
              Guardá el caso primero para poder editar el script
            </span>
          )}
        </div>
      </div>

      {/* Editor (client-only) */}
      <div
        ref={mountRef}
        className="border border-gray-200 rounded overflow-hidden"
        data-testid="codigo-editor-mount"
      >
        {EditorComp ? (
          <EditorComp
            height="480px"
            defaultLanguage="typescript"
            value={contenido}
            onChange={handleChange}
            onMount={handleMount}
            options={{
              readOnly: !editable,
              minimap: { enabled: false },
              wordWrap: "on",
              fontSize: 13,
              scrollBeyondLastLine: false,
            }}
            theme="vs"
          />
        ) : (
          <div
            className="flex items-center justify-center h-[480px] bg-gray-50 text-sm text-gray-500"
            data-testid="monaco-loading"
          >
            Cargando editor…
          </div>
        )}
      </div>

      {/* Mensajes */}
      {errorMsg && (
        <div
          role="alert"
          data-testid="codigo-editor-error"
          className="px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {errorMsg}
        </div>
      )}
      {okMsg && (
        <div
          data-testid="codigo-editor-ok"
          className="px-3 py-2 rounded bg-green-50 border border-green-200 text-sm text-green-700"
        >
          {okMsg}
        </div>
      )}
    </div>
  );
}
