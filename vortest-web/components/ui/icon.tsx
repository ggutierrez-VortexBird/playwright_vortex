import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
}

// Decorativo siempre; el glifo sale de ::before (attr data-icon) para que el nombre de la ligadura no quede en el texto del DOM.
export function Icon({ name, size = 20, filled = false, className }: IconProps) {
  const style: CSSProperties = {
    fontSize: size,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
  };
  return (
    <span aria-hidden="true" translate="no" data-icon={name} className={cn("material-symbols-outlined select-none", className)} style={style} />
  );
}
