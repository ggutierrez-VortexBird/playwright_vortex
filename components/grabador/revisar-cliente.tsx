"use client";

/**
 * RevisarCliente — pantalla de revisión post-grabación (pivot V2 +
 * editor real).
 *
 * Look & feel: réplica de documentacion/referencias-diseño/cambios/editor-codigo.html
 * — tarjeta de metadatos/acciones arriba, editor estilo IDE oscuro a la
 * izquierda (8 cols) y panel inspector (pasos grabados + parámetros) a la
 * derecha (4 cols).
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
import { parseSpecToSteps, type SpecLineKind } from "@/lib/recorder/parse-spec";
import { configureVortestEditor, VORTEST_DARK_THEME } from "@/lib/recorder/monaco-setup";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono-code text-body-sm text-slate-400">
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

const KIND_LABEL: Record<SpecLineKind, string> = {
  import: "Import",
  "test-header": "Definición del test",
  goto: "Navegación",
  click: "Click",
  fill: "Completar campo",
  press: "Presionar tecla",
  check: "Marcar casilla",
  select: "Seleccionar opción",
  hover: "Hover",
  assertion: "Aserción",
  navigate: "Espera",
  comment: "Comentario",
  other: "Otro",
};

const KIND_COLOR: Record<SpecLineKind, string> = {
  import: "bg-m3-surface-container-high text-m3-on-surface-variant",
  "test-header": "bg-m3-surface-container-high text-m3-on-surface-variant",
  goto: "bg-m3-info-container text-m3-info",
  click: "bg-m3-secondary-container text-m3-secondary",
  fill: "bg-m3-secondary-container text-m3-secondary",
  press: "bg-m3-secondary-container text-m3-secondary",
  check: "bg-m3-secondary-container text-m3-secondary",
  select: "bg-m3-secondary-container text-m3-secondary",
  hover: "bg-m3-secondary-container text-m3-secondary",
  assertion: "bg-m3-success-container text-m3-success",
  navigate: "bg-m3-info-container text-m3-info",
  comment: "bg-m3-surface-container-high text-m3-on-surface-variant",
  other: "bg-m3-surface-container-high text-m3-on-surface-variant",
};

function formatBytes(chars: number): string {
  if (chars === 0) return "0 B";
  const kb = chars / 1024;
  if (kb < 1) return `${chars} B`;
  return `${kb.toFixed(1)} KB`;
}

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
  const [syntaxErrorCount, setSyntaxErrorCount] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const dirty = useMemo(() => code !== original, [code, original]);
  const yaGuardado = savedCasoId !== null;
  const fragileSelectors = useMemo(() => findFragileSelectors(code), [code]);
  const steps = useMemo(
    () => parseSpecToSteps(code).filter((s) => s.rawText.length > 0 && s.kind !== "import"),
    [code],
  );
  const assertionCount = useMemo(() => steps.filter((s) => s.kind === "assertion").length, [steps]);
  const lineCount = useMemo(() => (code ? code.split("\n").length : 0), [code]);

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

  // markers viene tipado por monaco-editor; evitamos importar el paquete
  // completo solo por el tipo y nos quedamos con la forma mínima que usamos.
  function handleValidate(markers: { severity: number }[]) {
    setSyntaxErrorCount(markers.filter((m) => m.severity === 8).length);
  }

  return (
    <div data-testid="revisar-cliente" className="flex flex-col gap-4">
      {/* Tarjeta de metadatos del caso + acciones */}
      <section className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="flex items-center gap-2 font-headline text-headline-sm text-m3-on-surface">
                  <span className="font-body font-medium text-m3-on-surface-variant">Revisar caso:</span>
                  <span className="rounded-md border border-m3-info bg-m3-info-container px-2.5 py-1 font-mono-code text-body-sm font-semibold text-m3-info">
                    {nombre}
                  </span>
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-m3-success bg-m3-success-container px-2 py-0.5 font-label text-label-sm font-semibold text-m3-success">
                    {ambiente}
                  </span>
                  <span className="rounded-full border border-m3-outline-variant bg-m3-surface-container px-2 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
                    {navegador}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono-code text-label-sm text-m3-on-surface-variant">
                <span className="material-symbols-outlined text-[15px]">link</span>
                <a href={urlInicial} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-2 hover:text-m3-secondary hover:underline">
                  {urlInicial}
                </a>
                <span className="text-m3-outline-variant">•</span>
                {dirty && !yaGuardado ? (
                  <span
                    data-testid="dirty-indicator"
                    className="rounded bg-m3-secondary-fixed px-2 py-0.5 font-label text-label-sm text-m3-on-secondary-fixed"
                  >
                    Editado sin guardar
                  </span>
                ) : (
                  <span className="font-body text-label-sm text-m3-on-surface-variant">
                    {yaGuardado ? "Caso guardado" : "Grabación finalizada"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="copy-spec-btn"
                  onClick={handleCopiar}
                  disabled={!code}
                  title="Copiar script al portapapeles"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-label text-label-sm font-semibold text-m3-on-surface shadow-sm transition hover:bg-m3-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
                {dirty && !yaGuardado && (
                  <button
                    type="button"
                    data-testid="descartar-cambios-btn"
                    onClick={handleDescartarCambios}
                    title="Descartar cambios"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-label text-label-sm font-semibold text-m3-error shadow-sm transition hover:bg-m3-error-container disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    Descartar cambios
                  </button>
                )}
              </div>

              <div className="hidden h-6 w-px bg-m3-outline-variant sm:block" />

              <div className="flex items-center gap-2">
                {yaGuardado ? (
                  <a
                    href={`/casos/${savedCasoId}`}
                    data-testid="ver-caso-btn"
                    className="rounded-lg bg-m3-primary px-3.5 py-1.5 font-label text-label-sm font-semibold text-m3-on-primary shadow-sm transition hover:opacity-90"
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3.5 py-1.5 font-label text-label-sm font-semibold text-m3-on-surface shadow-sm transition hover:bg-m3-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      {busy === "guardar" ? "Guardando…" : "Guardar caso"}
                    </button>
                    <button
                      type="button"
                      data-testid="guardar-ejecutar-btn"
                      onClick={() => handleGuardar(true)}
                      disabled={busy !== null || !code}
                      className="inline-flex items-center gap-2 rounded-lg bg-m3-inverse-surface px-4 py-1.5 font-label text-label-sm font-bold text-m3-inverse-on-surface shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                      {busy === "guardar-ejecutar" ? "Guardando y ejecutando…" : "Guardar y ejecutar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Franja de telemetría */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-m3-outline-variant pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-label text-label-sm font-semibold ${
                  syntaxErrorCount > 0
                    ? "border-m3-error bg-m3-error-container text-m3-error"
                    : "border-m3-success bg-m3-success-container text-m3-success"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {syntaxErrorCount > 0 ? "error" : "check_circle"}
                </span>
                {syntaxErrorCount > 0
                  ? `${syntaxErrorCount} problema${syntaxErrorCount === 1 ? "" : "s"} de sintaxis`
                  : "Script generado correctamente"}
              </span>
              <span className="rounded-md border border-m3-outline-variant bg-m3-surface-container px-2 py-1 font-label text-label-sm font-medium text-m3-on-surface-variant">
                {lineCount} línea{lineCount === 1 ? "" : "s"}
              </span>
              <span className="rounded-md border border-m3-outline-variant bg-m3-surface-container px-2 py-1 font-label text-label-sm font-medium text-m3-on-surface-variant">
                {assertionCount} aserción{assertionCount === 1 ? "" : "es"}
              </span>
              <span
                className={`rounded-md border px-2 py-1 font-label text-label-sm font-medium ${
                  fragileSelectors.length > 0
                    ? "border-m3-secondary bg-m3-secondary-container text-m3-secondary"
                    : "border-m3-outline-variant bg-m3-surface-container text-m3-on-surface-variant"
                }`}
              >
                {fragileSelectors.length} selector{fragileSelectors.length === 1 ? "" : "es"} frágil{fragileSelectors.length === 1 ? "" : "es"}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-m3-outline-variant bg-m3-surface-container px-2.5 py-1 font-mono-code text-[11px] text-m3-on-surface-variant">
              <span>Sesión:</span>
              <span className="font-medium text-m3-on-surface">{sesionId}</span>
            </div>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          data-testid="revisar-error"
          className="rounded-xl border border-m3-error bg-m3-error-container px-4 py-3 font-body text-body-sm text-m3-error"
        >
          {errorMsg}
        </div>
      )}

      {fragileSelectors.length > 0 && (
        <div
          role="alert"
          data-testid="selectores-fragiles-aviso"
          className="rounded-xl border border-m3-secondary bg-m3-secondary-container px-4 py-3 font-body text-body-sm text-m3-on-secondary-container"
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
          <p className="mt-1 text-xs text-m3-on-secondary-container">
            Playwright cayó a &quot;el primer/enésimo &lt;div&gt;&quot; en vez de un
            selector por rol o texto, seguramente porque la página cambió el
            DOM justo durante el click. Corrige esa línea a mano (por
            ejemplo con <code>getByRole</code> o <code>getByText</code>) o
            vuelve a grabar ese paso más despacio.
          </p>
        </div>
      )}

      {!original && !yaGuardado && (
        <div
          role="alert"
          data-testid="sin-spec-aviso"
          className="rounded-xl border border-m3-outline-variant bg-m3-surface-container px-4 py-3 font-body text-body-sm text-m3-on-surface-variant"
        >
          El grabador no emitió ningún código. Puedes escribir el script a
          mano aquí abajo, o volver a grabar.
        </div>
      )}

      {/* Editor (8 cols) + inspector (4 cols) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow-xl lg:col-span-8 lg:h-[560px]">
          {/* Titlebar + tab del archivo */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#0b1120] px-3 py-2">
            <div className="flex items-center gap-2 rounded-t-md border-t-2 border-blue-500 bg-[#0f172a] px-3 py-1.5 font-mono-code text-xs text-slate-200 shadow">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-[9px] font-bold text-white">
                TS
              </span>
              <span className="font-medium" data-testid="filename-hint">
                {suggestedFileName}
              </span>
              <span className="ml-1 text-[10px] text-slate-500">{formatBytes(code.length)}</span>
            </div>
            <button
              type="button"
              onClick={handleDescartarCambios}
              disabled={!dirty || yaGuardado}
              title="Descartar cambios y volver al script original"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>

          {/* Ruta del archivo */}
          <div className="truncate border-b border-slate-800 bg-[#0d1424] px-4 py-1.5 font-mono-code text-[11px] text-slate-400">
            {codegenFilePath ?? suggestedFileName}
          </div>

          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme={VORTEST_DARK_THEME}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              beforeMount={configureVortestEditor}
              onValidate={handleValidate}
              options={{
                readOnly: yaGuardado,
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
            <div className="flex items-center gap-4">
              {syntaxErrorCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {syntaxErrorCount} problema{syntaxErrorCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Sintaxis TS válida
                </span>
              )}
              <span>{lineCount} líneas</span>
            </div>
            <span className="text-slate-500">Playwright Test Runner</span>
          </div>
        </div>

        {/* Panel inspector */}
        <div className="space-y-4 lg:col-span-4">
          <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
            <div className="flex items-center justify-between border-b border-m3-outline-variant bg-m3-surface-container p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-m3-info" />
                <h2 className="font-headline text-label-lg font-semibold text-m3-on-surface">
                  Pasos grabados ({steps.length})
                </h2>
              </div>
            </div>
            <div className="scroll-hidden max-h-[280px] space-y-1 overflow-y-auto p-3">
              {steps.length === 0 ? (
                <p className="p-2 font-body text-body-sm text-m3-on-surface-variant">
                  Todavía no hay pasos en el script.
                </p>
              ) : (
                steps.map((step, idx) => {
                  const isExpanded = expandedStep === idx;
                  return (
                    <button
                      key={`${step.number}-${idx}`}
                      type="button"
                      onClick={() => setExpandedStep(isExpanded ? null : idx)}
                      aria-expanded={isExpanded}
                      data-testid="paso-grabado-item"
                      className={`flex w-full items-start gap-3 rounded-lg border p-2 text-left transition ${
                        isExpanded
                          ? "border-m3-outline-variant bg-m3-surface-container"
                          : "border-transparent hover:border-m3-outline-variant hover:bg-m3-surface-container"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-label text-label-sm font-bold ${KIND_COLOR[step.kind]}`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`min-w-0 flex-1 font-body text-body-sm font-semibold text-m3-on-surface ${
                              isExpanded ? "break-words" : "truncate"
                            }`}
                          >
                            {step.description || step.kind}
                          </p>
                          <span
                            className={`material-symbols-outlined shrink-0 text-[18px] text-m3-on-surface-variant transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 font-mono-code text-label-sm text-m3-on-surface-variant ${
                            isExpanded ? "whitespace-pre-wrap break-all" : "truncate"
                          }`}
                        >
                          {step.rawText}
                        </p>
                        {isExpanded && (
                          <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-m3-outline-variant pt-2 text-[11px]">
                            <div>
                              <dt className="font-label font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                                Tipo
                              </dt>
                              <dd className="text-m3-on-surface">{KIND_LABEL[step.kind]}</dd>
                            </div>
                            <div>
                              <dt className="font-label font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                                Línea
                              </dt>
                              <dd className="font-mono-code text-m3-on-surface">{step.number}</dd>
                            </div>
                            {step.selectorText && (
                              <div className="col-span-2">
                                <dt className="font-label font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                                  Selector
                                </dt>
                                <dd className="break-all font-mono-code text-m3-on-surface">
                                  {step.selectorText}
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3.5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-headline text-label-lg font-semibold text-m3-on-surface">
              <span className="material-symbols-outlined text-[18px] text-m3-on-surface-variant">tune</span>
              Parámetros de la sesión
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Ambiente" value={ambiente} />
              <Field label="Navegador" value={navegador} />
              <Field label="Tamaño del script" value={formatBytes(code.length)} />
              <Field label="Selectores frágiles" value={String(fragileSelectors.length)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container p-2.5">
      <span className="block font-label text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant">
        {label}
      </span>
      <span className="font-body text-body-sm font-semibold text-m3-on-surface">{value}</span>
    </div>
  );
}
