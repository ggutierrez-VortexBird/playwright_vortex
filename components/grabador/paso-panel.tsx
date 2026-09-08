"use client";

/**
 * PasoPanel — panel derecho del modo grabador que muestra los pasos
 * grabados hasta ahora, parseados del spec.ts en vivo.
 *
 * Cero modificación al spec.ts: solo lee lo que `npx playwright codegen`
 * está escribiendo, lo clasifica, y lo presenta legible.
 *
 * Cada paso tiene un icono distinto según `kind`:
 *   - goto →      play_circle
 *   - click →     touch_app
 *   - fill/press → keyboard
 *   - assertion → check_circle
 *   - hover/select/check → misc
 */

import { parseSpecToSteps, type SpecLine } from "@/lib/recorder/parse-spec";

export interface PasoPanelProps {
  /** Contenido crudo del .spec.ts (vía WS `spec_updated`). */
  specContent: string;
  /** Bytes del spec — para mostrar "X KB" en el footer. */
  bytes: number;
  /** True cuando hay datos (hide empty state). */
  isLive: boolean;
}

const KIND_ICON: Record<string, string> = {
  goto: "play_circle",
  click: "touch_app",
  fill: "keyboard",
  press: "keyboard",
  check: "check_box",
  select: "arrow_drop_down_circle",
  hover: "pan_tool",
  assertion: "verified",
  navigate: "auto_awesome",
  other: "more_horiz",
};

const KIND_LABEL: Record<string, string> = {
  goto: "Navegar",
  click: "Click",
  fill: "Completar",
  press: "Presionar",
  check: "Marcar",
  select: "Seleccionar",
  hover: "Hover",
  assertion: "Verificar",
  navigate: "Esperar",
  other: "Otro",
};

export function PasoPanel({ specContent, bytes, isLive }: PasoPanelProps) {
  const steps = parseSpecToSteps(specContent);
  const count = steps.length;

  return (
    <aside
      data-testid="paso-panel"
      className="flex h-full min-h-0 flex-col border-l border-m3-outline-variant bg-m3-surface-container-low"
    >
      <header
        data-testid="paso-panel-header"
        className="flex items-center justify-between border-b border-m3-outline-variant px-4 py-3"
      >
        <h2 className="font-headline text-headline-sm text-m3-on-surface">
          Pasos grabados
        </h2>
        <span
          data-testid="paso-count"
          className="rounded-full bg-m3-primary-container px-3 py-1 font-mono-code text-label-sm text-m3-on-primary-container"
        >
          {count}
        </span>
      </header>
      <ol
        data-testid="paso-list"
        className="min-h-0 flex-1 overflow-auto px-2 py-2"
      >
        {count === 0 ? (
          <li
            data-testid="paso-empty"
            className="m-2 rounded border border-dashed border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center"
          >
            <span className="material-symbols-outlined block text-[48px] text-m3-on-surface-variant">
              hourglass_empty
            </span>
            <p className="mt-3 font-body text-body-md text-m3-on-surface-variant">
              {isLive
                ? "Esperando el primer paso… interactuá con el navegador codegen."
                : "Iniciá la grabación para ver los pasos acá."}
            </p>
          </li>
        ) : (
          steps.map((step, idx) => (
            <PasoItem
              key={`${step.number}-${idx}`}
              step={step}
              index={idx + 1}
            />
          ))
        )}
      </ol>
      <footer
        data-testid="paso-panel-footer"
        className="border-t border-m3-outline-variant px-4 py-2 font-mono-code text-label-sm text-m3-on-surface-variant"
      >
        {count === 0 ? "—" : `${count} paso${count === 1 ? "" : "s"}`} ·{" "}
        {formatBytes(bytes)} de spec.ts
      </footer>
    </aside>
  );
}

function PasoItem({ step, index }: { step: SpecLine; index: number }) {
  const icon = KIND_ICON[step.kind] ?? "more_horiz";
  const label = KIND_LABEL[step.kind] ?? step.kind;
  return (
    <li
      data-testid="paso-item"
      data-paso-kind={step.kind}
      className="group my-1 flex gap-3 rounded border border-transparent px-3 py-2 transition hover:border-m3-outline-variant hover:bg-m3-surface-container"
    >
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-m3-primary-container font-mono-code text-label-sm text-m3-on-primary-container"
        aria-label={`Paso ${index}`}
      >
        {index}
      </span>
      <span className="shrink-0 text-m3-secondary">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-headline text-label-md uppercase tracking-wide text-m3-secondary">
            {label}
          </span>
        </div>
        <p
          data-testid="paso-description"
          className="mt-0.5 break-words font-body text-body-md text-m3-on-surface"
        >
          {step.description}
        </p>
      </div>
    </li>
  );
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const kb = b / 1024;
  if (kb < 1) return `${b} B`;
  if (kb < 10) return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
}
