"use client";

/**
 * RecordingInstructions — tarjeta instructiva que aparece en el slot
 * izquierdo del modo grabador, en lugar del canvas viejo de V1.
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
}: RecordingInstructionsProps) {
  const liveUrl = currentUrl ?? urlInicial;

  return (
    <div
      data-testid="recording-instructions"
      className="flex h-full flex-col items-center justify-center gap-6 bg-m3-surface-container-lowest p-8 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-m3-primary-container text-m3-on-primary-container">
        <span className="material-symbols-outlined text-[56px]">
          open_in_new
        </span>
      </div>
      <div className="max-w-lg">
        <h3 className="mb-2 font-headline text-headline-md text-m3-on-surface">
          Grabando en una ventana separada
        </h3>
        <p className="font-body text-body-md text-m3-on-surface-variant">
          Playwright abrió una ventana de{" "}
          <strong className="text-m3-on-surface">Chromium</strong>{" "}
          (headed) para esta sesión. Interactuá con el sitio objetivo
          ahí — los pasos aparecerán automáticamente en el panel de la
          derecha.
        </p>
      </div>

      <dl className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="URL actual"
          value={liveUrl}
          testid="recording-current-url"
          mono
          truncate
        />
        <Stat
          label="Pasos grabados"
          value={String(pasosCount)}
          testid="recording-pasos-count"
        />
        <Stat
          label="Aserciones"
          value={String(assertionCount)}
          testid="recording-assertions-count"
        />
        <Stat
          label="Tamaño .spec.ts"
          value={formatBytes(bytes)}
          testid="recording-bytes"
        />
        <Stat
          label="Estado"
          value={connStateLabel(connState)}
          testid="recording-conn-state"
          accent={connState === "live" ? "secondary" : "error"}
        />
        <Stat
          label="Acciones"
          value={summarizeKinds(kinds)}
          testid="recording-kinds"
        />
      </dl>

      {errorMsg && (
        <div
          data-testid="recording-error"
          className="rounded border border-red-700 bg-red-950/40 px-4 py-2 font-body text-body-sm text-red-100"
        >
          {errorMsg}
        </div>
      )}

      <p className="font-body text-body-sm text-m3-on-surface-variant/80">
        Tip: el botón{" "}
        <span className="rounded bg-m3-surface-container-highest px-2 py-0.5 font-mono-code text-label-sm">
          Record
        </span>{" "}
        del toolbar de Playwright codegen ya está activo — no hace falta
        hacer click para empezar a capturar.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  testid,
  mono = false,
  truncate = false,
  accent,
}: {
  label: string;
  value: string;
  testid: string;
  mono?: boolean;
  truncate?: boolean;
  accent?: "secondary" | "error";
}) {
  const valueClass = [
    "font-body text-body-md",
    mono ? "font-mono-code" : "",
    truncate ? "truncate" : "",
    accent === "secondary"
      ? "text-m3-secondary"
      : accent === "error"
        ? "text-red-700"
        : "text-m3-on-surface",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="rounded border border-m3-outline-variant bg-m3-surface-container px-3 py-2 text-left">
      <dt className="font-mono-code text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
        {label}
      </dt>
      <dd data-testid={testid} className={valueClass}>
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
