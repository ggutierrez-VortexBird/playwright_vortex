"use client";

import { useEffect, useRef } from "react";
import type { SpecLine, SpecLineKind } from "@/lib/recorder/parse-spec";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const ICONO: Partial<Record<SpecLineKind, string>> = {
  goto: "language",
  navigate: "language",
  click: "ads_click",
  fill: "keyboard",
  press: "keyboard_return",
  check: "check_box",
  select: "list",
  hover: "mouse",
  assertion: "fact_check",
};

/** Lista de pasos que codegen va escribiendo; anuncia sólo el último a lectores de pantalla. */
export function PasosEnVivo({ pasos, grabando }: { pasos: SpecLine[]; grabando: boolean }) {
  const finRef = useRef<HTMLLIElement | null>(null);
  const ultimo = pasos[pasos.length - 1];

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pasos.length]);

  return (
    <section aria-labelledby="pasos-en-vivo-titulo" className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      <div className="flex items-center justify-between border-b border-m3-outline-variant px-4 py-3">
        <h2 id="pasos-en-vivo-titulo" className="font-headline text-headline-sm text-m3-on-surface">
          Pasos grabados
        </h2>
        <span className="rounded-full bg-m3-surface-container-high px-2 font-label text-label-sm text-m3-on-surface-variant">{pasos.length}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {ultimo ? `Paso ${pasos.length}: ${ultimo.description}` : ""}
      </p>
      {pasos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <Icon name={grabando ? "radio_button_checked" : "hourglass_empty"} size={28} className={cn("text-m3-on-surface-variant", grabando && "text-m3-error")} />
          <p className="font-body text-body-sm text-m3-on-surface-variant">
            {grabando
              ? "Interactúa con la página en la ventana del grabador: cada acción aparece aquí."
              : "Los pasos aparecerán cuando el grabador esté conectado."}
          </p>
        </div>
      ) : (
        <ol className="scroll-hidden max-h-[420px] divide-y divide-m3-outline-variant overflow-y-auto">
          {pasos.map((p, i) => (
            <li
              key={`${p.number}-${i}`}
              ref={i === pasos.length - 1 ? finRef : undefined}
              className={cn("flex items-start gap-3 px-4 py-2.5", i === pasos.length - 1 && "animate-in fade-in-0 slide-in-from-bottom-1 duration-base motion-reduce:animate-none")}
            >
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono-code text-label-xs text-m3-on-surface-variant">{i + 1}</span>
              <Icon name={ICONO[p.kind] ?? "code"} size={18} className={cn("mt-px shrink-0", p.kind === "assertion" ? "text-m3-success" : "text-m3-primary")} />
              <div className="min-w-0">
                <p className="font-body text-body-sm text-m3-on-surface">{p.description}</p>
                {p.selectorText && <p className="truncate font-mono-code text-label-xs text-m3-on-surface-variant">{p.selectorText}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
