"use client";

/**
 * RecordingInstructions — tarjeta hero de la sesión activa.
 *
 * Look & feel: réplica de la "Hero Card de Sesión Activa Externa" del
 * mockup documentacion/referencias-diseño/cambios/grabador.html — un
 * mockup ilustrativo de "ventana externa" (Playwright codegen headed)
 * seguido de una grilla de telemetría de la sesión.
 *
 * Explica al QA que la grabación corre en una ventana separada del
 * navegador (Chromium headed que abrió Playwright codegen) y que
 * interactúe ahí. Esta es la decisión de arquitectura #8 del plan
 * ACTA-Plan-Browser-Headed-Real.md.
 */
import type { SpecLineKind } from "@/lib/recorder/parse-spec";

export interface RecordingInstructionsProps {
  /** URL inicial que el QA tipeó en el form. */
  urlInicial: string;
  /** Última URL conocida del browser (sync vía `url_changed` del worker). */
  currentUrl?: string;
  /** Cantidad de pasos grabados al instante. */
  pasosCount: number;
  /** Conteo de assertions capturadas. */
  assertionCount: number;
  /** Bytes del spec.ts (placeholder mientras no se haya hecho nada). */
  bytes: number;
  /** Estado de conexión (para mostrar progreso inicial). */
  connState:
    | "connecting"
    | "live"
    | "reconnecting"
    | "error"
    | "closed";
  /** Si hay un error del worker o el spec. */
  errorMsg?: string | null;
  /** Tipos de paso capturados hasta el momento (para el resumen). */
  kinds?: SpecLineKind[];
  /** true = todavía no se inició la grabación real (pantalla "Play"). */
  idle?: boolean;
}

export function RecordingInstructions({
  urlInicial,
  currentUrl,
  pasosCount,
  assertionCount,
  bytes,
  connState,
  errorMsg,
  kinds = [],
  idle = false,
}: RecordingInstructionsProps) {
  const liveUrl = currentUrl ?? urlInicial;
  const isLive = connState === "live";

  return (
    <div
      data-testid="recording-instructions"
      className="relative overflow-hidden rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-m3-info-container opacity-40 blur-3xl"
      />

      {/* Mockup de ventana externa (Playwright codegen headed) */}
      <div className="relative mb-6 overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-low shadow-sm">
        <div className="flex items-center justify-between border-b border-m3-outline-variant bg-m3-surface-container px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-m3-outline-variant" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-m3-outline-variant" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-m3-outline-variant" />
            </div>
            <div className="mx-0.5 hidden h-3.5 w-px bg-m3-outline-variant sm:block" />
            <div className="hidden items-center gap-2 rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-2.5 py-1 font-label text-label-sm font-medium text-m3-on-surface shadow-sm sm:flex">
              <span className="material-symbols-outlined text-[16px] text-m3-on-surface-variant">devices</span>
              Navegador de pruebas — Grabación activa
            </div>
          </div>
          <span
            data-testid="recording-conn-state"
            className={`rounded border px-2 py-0.5 font-mono-code text-label-sm font-semibold ${
              isLive
                ? "border-m3-error/20 bg-m3-error-container text-m3-error"
                : "border-m3-outline-variant bg-m3-surface-container-lowest text-m3-on-surface-variant"
            }`}
          >
            {idle ? "Sin iniciar" : connStateLabel(connState)}
          </span>
        </div>

        <div className="flex flex-col items-center bg-m3-surface-container-lowest p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-m3-info/30 bg-m3-info-container text-m3-info shadow-sm">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              videocam
            </span>
          </div>
          <h3 className="font-headline text-headline-sm text-m3-on-surface">
            {idle ? "Todo listo para grabar" : "Grabando en una ventana separada"}
          </h3>
          <p className="mt-2 max-w-md font-body text-body-sm text-m3-on-surface-variant">
            {idle ? (
              <>
                Al hacer click en <strong className="text-m3-on-surface">Iniciar grabación</strong> se abre una
                ventana de Chromium (headed) dedicada a esta sesión. Puede tardar unos segundos en aparecer.
              </>
            ) : (
              <>
                Playwright abrió una ventana de <strong className="text-m3-on-surface">Chromium</strong> (headed)
                dedicada a esta sesión. Interactúa libremente con el sitio — los pasos se sincronizan aquí
                en tiempo real.
              </>
            )}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-m3-outline-variant bg-m3-surface-container px-3.5 py-1.5 font-body text-body-sm text-m3-on-surface-variant">
            <span
              data-testid="recording-current-url"
              className="max-w-[220px] truncate font-mono-code text-label-sm text-m3-on-surface sm:max-w-xs"
              title={liveUrl}
            >
              {liveUrl}
            </span>
          </div>
        </div>
      </div>

      {/* Telemetría de la sesión */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pasos grabados" value={String(pasosCount)} testid="recording-pasos-count" />
        <Stat label="Aserciones" value={String(assertionCount)} testid="recording-assertions-count" />
        <Stat label="Tamaño .spec.ts" value={formatBytes(bytes)} testid="recording-bytes" />
        <Stat label="Acciones" value={summarizeKinds(kinds)} testid="recording-kinds" />
      </dl>

      {errorMsg && (
        <div
          data-testid="recording-error"
          className="mt-4 rounded-lg border border-m3-error bg-m3-error-container/60 px-4 py-2 font-body text-body-sm text-m3-error"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid: string;
}) {
  return (
    <div className="rounded-xl border border-m3-outline-variant/70 bg-m3-surface-container-low p-3">
      <span className="block font-label text-label-sm font-semibold uppercase tracking-wider text-m3-on-surface-variant">
        {label}
      </span>
      <dd data-testid={testid} className="mt-1 font-body text-body-md font-semibold text-m3-on-surface">
        {value}
      </dd>
    </div>
  );
}

function connStateLabel(
  state: RecordingInstructionsProps["connState"],
): string {
  switch (state) {
    case "live":
      return "Live";
    case "connecting":
      return "Conectando";
    case "reconnecting":
      return "Reconectando";
    case "error":
      return "Error";
    case "closed":
      return "Cerrado";
  }
}

function summarizeKinds(kinds: SpecLineKind[]): string {
  if (kinds.length === 0) return "—";
  const uniq = Array.from(new Set(kinds));
  return uniq
    .slice(0, 3)
    .map((k) => k)
    .join(" · ");
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const kb = b / 1024;
  if (kb < 1) return `${b} B`;
  if (kb < 10) return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
}
