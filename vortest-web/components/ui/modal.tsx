"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "./use-focus-trap";
import { Icon } from "@/components/ui/icon";

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  /** Con cambios sin guardar, Escape o un clic afuera piden confirmación en vez de cerrar y perder lo escrito. */
  hayCambios?: boolean;
}

/**
 * Overlay de modal compartido: Escape, clic afuera y foco atrapado.
 * `className` afecta el panel interno (p. ej. el ancho máximo) y se mergea con twMerge.
 */
export function Modal({ open, onClose, children, className, labelledBy, hayCambios = false, ...rest }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [abiertoAntes, setAbiertoAntes] = useState(open);
  if (abiertoAntes !== open) {
    setAbiertoAntes(open);
    if (!open) setConfirmando(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (hayCambios) setConfirmando(true);
      else onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, hayCambios]);

  useFocusTrap(panelRef, open);

  if (!open) return null;

  return (
    <div
      {...rest}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-modal flex items-center justify-center bg-m3-scrim/55 p-4 backdrop-blur-sm animate-in fade-in-0 duration-base motion-reduce:animate-none"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (hayCambios) setConfirmando(true);
        else onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "focus:outline-none",
          "w-full max-h-[85vh] overflow-y-auto rounded-lg bg-m3-surface-container-lowest shadow-modal animate-in fade-in-0 zoom-in-95 duration-base motion-reduce:animate-none",
          className ?? "max-w-md"
        )}
      >
        {confirmando && (
          <div role="alert" className="sticky top-0 z-sticky flex flex-wrap items-center gap-3 border-b border-m3-warning/30 bg-m3-warning-container px-4 py-3 font-body text-body-sm text-m3-on-warning-container">
            <Icon name="warning" size={18} filled />
            <span className="flex-1">Tienes cambios sin guardar.</span>
            <button type="button" onClick={() => setConfirmando(false)} className="rounded-sm px-2 py-1 font-label text-label-md font-semibold hover:underline" autoFocus>
              Seguir editando
            </button>
            <button type="button" onClick={onClose} className="rounded-sm px-2 py-1 font-label text-label-md font-semibold text-m3-error hover:underline">
              Descartar
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
