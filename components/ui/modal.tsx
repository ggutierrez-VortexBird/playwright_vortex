"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}

/**
 * Overlay de modal compartido: mismo blur/oscurecido de fondo, cierre con
 * Escape y click fuera, para que todas las pantallas de crear/editar se
 * vean y se comporten igual.
 */
export function Modal({ open, onClose, children, className, labelledBy }: ModalProps) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-m3-surface-container-lowest shadow-2xl ${className ?? "max-w-md"}`}>
        {children}
      </div>
    </div>
  );
}
