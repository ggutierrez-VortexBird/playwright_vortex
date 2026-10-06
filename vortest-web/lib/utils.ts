import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import tailwindConfig from "@/tailwind.config";

// tailwind-merge no conoce, por defecto, los tokens custom de este proyecto
// (colores `m3-*` y la escala tipográfica `label-sm/md/lg`, `headline-*`,
// `body-*`, `display`, `mono-code`). Sin esto, un nombre no reconocido como
// `text-label-sm` cae en el mismo grupo de conflicto que `text-m3-on-primary`
// (ambos son `text-<algo>` sin match en las listas por defecto de
// tailwind-merge) y el que aparece último en el `cn(...)` borra al otro —
// p. ej. `Button` perdía silenciosamente su color de texto porque el tamaño
// (`text-label-sm`) se aplicaba después del color (`text-m3-on-primary`).
const m3ColorClasses = Object.keys(
  (tailwindConfig.theme?.extend?.colors as Record<string, unknown> | undefined)?.m3 ?? {}
).map((key) => `m3-${key}`);
const fontSizeClasses = Object.keys(tailwindConfig.theme?.extend?.fontSize ?? {});

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: fontSizeClasses }],
      "text-color": [{ text: m3ColorClasses }],
      "bg-color": [{ bg: m3ColorClasses }],
      "border-color": [{ border: m3ColorClasses }],
      "ring-color": [{ ring: m3ColorClasses }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
