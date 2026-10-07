"use client";

import { useSyncExternalStore } from "react";
import { aplicarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from "@/lib/tema";
import { Icon } from "@/components/ui/icon";

const OPCIONES: { valor: PreferenciaTema; etiqueta: string; icono: string }[] = [
  { valor: "light", etiqueta: "Claro", icono: "light_mode" },
  { valor: "dark", etiqueta: "Oscuro", icono: "dark_mode" },
  { valor: "system", etiqueta: "Sistema", icono: "contrast" },
];

const oyentes = new Set<() => void>();
function suscribir(alCambiar: () => void) {
  oyentes.add(alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

export function ThemeToggle() {
  const actual = useSyncExternalStore(suscribir, leerPreferenciaTema, () => "system" as PreferenciaTema);

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-md bg-m3-surface-container p-1">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={actual === o.valor}
          onClick={() => {
            aplicarPreferenciaTema(o.valor);
            oyentes.forEach((f) => f());
          }}
          className="flex flex-col items-center gap-0.5 rounded-sm px-2 py-1.5 font-label text-label-xs text-m3-on-surface-variant transition-colors duration-fast ease-standard hover:text-m3-on-surface aria-checked:bg-m3-surface-container-lowest aria-checked:text-m3-on-surface aria-checked:shadow-card"
        >
          <Icon name={o.icono} size={18} />
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
