"use client";

/**
 * RevisarCliente — pantalla de revisión post-grabación (pivot V2 +
 * editor real).
 *
 * La fuente de verdad es el specCode crudo que escribió el grabador de
 * Playwright. Esta pantalla permite:
 *
 *   - Ver y EDITAR el .spec.ts con un editor de código de verdad (Monaco),
 *     no un bloque de solo lectura. La edición es una decisión explícita
 *     del usuario — no una decoración automática del sistema — así que no
 *     choca con la política ZERO modificación sobre lo que produce el
 *     grabador: lo que el usuario tipeó es, literalmente, lo que se guarda.
 *   - "Descartar cambios" para volver al texto tal cual lo grabó Playwright.
 *   - "Guardar caso": persiste el CasoPrueba y va al detalle.
 *   - "Guardar y ejecutar": persiste el CasoPrueba, encola una ejecución
 *     inmediata y va directo al detalle de esa ejecución.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { findFragileSelectors } from "@/lib/recorder/selector-lint";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-body text-body-sm text-m3-on-surface-variant">
      Cargando editor…
    </div>
  ),
});

export interface RevisarClienteProps {
  sesionId: string;
  nombre: string;
  /** Spec.ts crudo escrito por el grabador. */
  specCode: string | null;
  /** CasoPrueba al que se guardó (si ya fue guardado antes). */
  casoPruebaId: string | null;
  /** Nombre del archivo .spec.ts sugerido al guardar. */
  suggestedFileName: string;
  /** URL inicial (informativo). */
  urlInicial: string;
  /** Ambiente (informativo). */
  ambiente: string;
  /** Navegador (informativo). */
  navegador: string;
  /** Path del .spec.ts en disco (debug / "abrir archivo"). */
  codegenFilePath: string | null;
}

type GuardarAction = "guardar" | "guardar-ejecutar" | null;

export function RevisarCliente({
  sesionId,
  nombre,
  specCode,
  casoPruebaId,
  suggestedFileName,
  urlInicial,
  ambiente,
  navegador,
  codegenFilePath,
}: RevisarClienteProps) {
  const router = useRouter();
  const original = specCode ?? "";
  const [code, setCode] = useState(original);
  const [busy, setBusy] = useState<GuardarAction>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedCasoId, setSavedCasoId] = useState<string | null>(casoPruebaId);

  const dirty = useMemo(() => code !== original, [code, original]);
  const yaGuardado = savedCasoId !== null;
  const fragileSelectors = useMemo(() => findFragileSelectors(code), [code]);

  async function handleGuardar(ejecutar: boolean) {
    if (busy || yaGuardado) return;
    if (!code.trim()) {
      setErrorMsg("El script no puede quedar vacío");
      return;
    }
    setBusy(ejecutar ? "guardar-ejecutar" : "guardar");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/guardar`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            script: dirty ? code : undefined,
            ejecutar,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        casoPruebaId?: string;
        redirectTo?: string;
        ejecucionError?: string;
        message?: string;
      };
      if (!res.ok) {
        setErrorMsg(
          data.message ?? `No se pudo guardar el caso (HTTP ${res.status})`,
        );
        return;
      }
      if (data.casoPruebaId) setSavedCasoId(data.casoPruebaId);
      if (data.ejecucionError) {
        // El caso quedó guardado, pero no se pudo encolar la ejecución —
        // no navegamos a una ejecución que no existe, avisamos y dejamos
        // que el usuario la dispare desde el detalle del caso.
        setErrorMsg(
          `Caso guardado, pero no se pudo encolar la ejecución: ${data.ejecucionError}`,
        );
        return;
      }
      if (data.redirectTo) {
        router.push(data.redirectTo);
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  async function handleCopiar() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg("El navegador bloqueó el acceso al portapapeles");
    }
  }

  function handleDescartarCambios() {
    setCode(original);
    setErrorMsg(null);
  }

  return (
    <div
      data-testid="revisar-cliente"
      className="flex h-[calc(100vh-160px)] min-h-[600px] flex-col overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-m3-outline-variant bg-m3-surface-container px-4 py-3">
        <div className="min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-headline text-headline-sm text-m3-on-surface">
              Revisar caso
            </span>
            <span className="rounded bg-m3-surface-container-high px-2 py-0.5 font-mono-code text-xs text-m3-on-surface-variant">
              {nombre}
            </span>
            <span className="rounded bg-m3-surface-container-high px-2 py-0.5 font-mono-code text-xs text-m3-on-surface-variant">
              {ambiente} · {navegador}
            </span>
            {dirty && !yaGuardado && (
              <span
                data-testid="dirty-indicator"
                className="rounded bg-m3-secondary-fixed px-2 py-0.5 font-label text-label-sm text-m3-on-secondary-fixed"
              >
                Editado sin guardar
              </span>
            )}
          </div>
          <span className="mt-1 truncate font-mono-code text-xs text-m3-on-surface-variant">
            {urlInicial}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="copy-spec-btn"
            onClick={handleCopiar}
            disabled={!code}
            className="rounded border border-m3-outline-variant px-3 py-1.5 font-label text-label-sm font-medium text-m3-on-surface hover:bg-m3-surface-container-high disabled:opacity-50 transition-colors"
          >
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
          {dirty && !yaGuardado && (
            <button
              type="button"
              data-testid="descartar-cambios-btn"
              onClick={handleDescartarCambios}
              className="rounded border border-m3-outline-variant px-3 py-1.5 font-label text-label-sm font-medium text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
            >
              Descartar cambios
            </button>
          )}
          {yaGuardado ? (
            <a
              href={`/casos/${savedCasoId}`}
              data-testid="ver-caso-btn"
              className="rounded bg-m3-primary px-3 py-1.5 font-label text-label-sm font-semibold text-m3-on-primary hover:opacity-90 transition-opacity"
            >
              Ver caso guardado
            </a>
          ) : (
            <>
              <button
                type="button"
                data-testid="guardar-btn"
                onClick={() => handleGuardar(false)}
                disabled={busy !== null || !code}
                className="rounded border border-m3-primary px-3 py-1.5 font-label text-label-sm font-semibold text-m3-primary hover:bg-m3-surface-container-high disabled:opacity-50 transition-colors"
              >
                {busy === "guardar" ? "Guardando…" : "Guardar caso"}
              </button>
              <button
                type="button"
                data-testid="guardar-ejecutar-btn"
                onClick={() => handleGuardar(true)}
                disabled={busy !== null || !code}
                className="flex items-center gap-1.5 rounded bg-m3-primary px-3 py-1.5 font-label text-label-sm font-semibold text-m3-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  play_arrow
                </span>
                {busy === "guardar-ejecutar"
                  ? "Guardando y ejecutando…"
                  : "Guardar y ejecutar"}
              </button>
            </>
          )}
        </div>
      </header>

      {errorMsg && (
        <div
          role="alert"
          data-testid="revisar-error"
          className="border-b border-m3-error/30 bg-m3-error-container/10 px-4 py-3 font-body text-body-sm text-m3-error"
        >
          {errorMsg}
        </div>
      )}

      <div className="border-b border-m3-outline-variant bg-m3-surface-container px-4 py-2 font-mono-code text-[11px] text-m3-on-surface-variant">
        <code data-testid="filename-hint">{suggestedFileName}</code>
        {codegenFilePath && (
          <span className="ml-2 truncate text-m3-on-surface-variant/70">
            · {codegenFilePath}
          </span>
        )}
      </div>

      {fragileSelectors.length > 0 && (
        <div
          role="alert"
          data-testid="selectores-fragiles-aviso"
          className="border-b border-m3-secondary/30 bg-m3-secondary-container/25 px-4 py-3 font-body text-body-sm text-m3-on-secondary-container"
        >
          <p className="font-medium">
            {fragileSelectors.length === 1
              ? "Hay un selector genérico que conviene revisar antes de guardar:"
              : `Hay ${fragileSelectors.length} selectores genéricos que conviene revisar antes de guardar:`}
          </p>
          <ul className="mt-1 list-inside list-disc font-mono-code text-xs">
            {fragileSelectors.map((w) => (
              <li key={w.line} data-testid="selector-fragil-item">
                Línea {w.line}: <code>{w.text}</code>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-m3-on-secondary-container/80">
            Playwright cayó a &quot;el primer/enésimo &lt;div&gt;&quot; en vez de un
            selector por rol o texto, seguramente porque la página cambió el
            DOM justo durante el click. Corregí esa línea a mano (por
            ejemplo con <code>getByRole</code> o <code>getByText</code>) o
            volvé a grabar ese paso más despacio.
          </p>
        </div>
      )}

      {!original && !yaGuardado && (
        <div
          role="alert"
          data-testid="sin-spec-aviso"
          className="border-b border-m3-outline-variant bg-m3-surface-container px-4 py-3 font-body text-body-sm text-m3-on-surface-variant"
        >
          El grabador no emitió ningún código. Podés escribir el script a
          mano acá abajo, o volver a grabar.
        </div>
      )}

      <main className="min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs"
          value={code}
          onChange={(value) => setCode(value ?? "")}
          options={{
            readOnly: yaGuardado,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </main>

      <footer className="border-t border-m3-outline-variant bg-m3-surface-container px-4 py-2 font-mono-code text-[11px] text-m3-on-surface-variant">
        Sesión: {sesionId.slice(0, 8)}…
      </footer>
    </div>
  );
}
