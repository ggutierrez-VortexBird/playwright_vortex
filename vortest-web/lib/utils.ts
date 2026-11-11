import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { TAMANOS_TEXTO, TOKENS_M3 } from "@/lib/design-tokens";

// Registra los tokens custom (`m3-*`, escala tipográfica) para que tailwind-merge no los trate como un mismo grupo de conflicto.
const m3ColorClasses = TOKENS_M3.map((t) => `m3-${t}`);
const fontSizeClasses = [...TAMANOS_TEXTO];

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
