"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}

/**
 * Overlay de modal compartido: mismo blur/oscurecido de fondo, cierre con
 * Escape y click fuera, para que todas las pantallas de crear/editar se
 * vean y se comporten igual. `className` afecta el panel interno (por
 * ejemplo para variar el ancho máximo); se mergea con `cn()` (twMerge) para
 * que valores conflictivos (p.ej. `max-h-*`) los resuelva el último en vez
 * de quedar ambos aplicados de forma ambigua. Cualquier otro prop nativo
 * (p.ej. `data-testid`) se reenvía al div exterior del backdrop.
 */
export function Modal({ open, onClose, children, className, labelledBy, ...rest }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      {...rest}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full max-h-[85vh] overflow-y-auto rounded-lg bg-m3-surface-container-lowest shadow-modal",
          className ?? "max-w-md"
        )}
      >
        {children}
      </div>
    </div>
  );
}
