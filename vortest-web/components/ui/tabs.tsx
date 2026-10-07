"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  /** Contador opcional junto a la etiqueta. */
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Prefijo de ids compartido con los paneles (ver tabPanelProps). */
  idBase: string;
  className?: string;
}

/** Pestañas accesibles (patrón WAI-ARIA): flechas, Inicio y Fin mueven el foco y la selección. */
export function Tabs({ items, value, onChange, label, idBase: base, className }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(desde: number, paso: number | "inicio" | "fin") {
    const n = items.length;
    const destino = paso === "inicio" ? 0 : paso === "fin" ? n - 1 : (desde + paso + n) % n;
    onChange(items[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 border-b border-m3-outline-variant", className)}>
      {items.map((item, i) => {
        const activo = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={activo}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") mover(i, 1);
              else if (e.key === "ArrowLeft") mover(i, -1);
              else if (e.key === "Home") mover(i, "inicio");
              else if (e.key === "End") mover(i, "fin");
              else return;
              e.preventDefault();
            }}
            className={cn(
              "relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 font-label text-label-lg transition-colors duration-fast ease-standard",
              activo
                ? "border-m3-primary text-m3-on-surface"
                : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
            )}
          >
            {item.label}
            {item.count != null && (
              <span className="rounded-full bg-m3-surface-container-high px-1.5 font-label text-label-xs text-m3-on-surface-variant">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(base: string, id: string) {
  return { role: "tabpanel" as const, id: `${base}-panel-${id}`, "aria-labelledby": `${base}-tab-${id}`, tabIndex: 0 };
}
