"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { StatusBadgeTone } from "@/components/ui/status-badge";

export interface ToastInput {
  tone?: StatusBadgeTone;
  title: string;
  description?: string;
  /** Enlace de seguimiento, p. ej. "Ver ejecución" o "Descargar acta". */
  action?: { label: string; href: string; download?: boolean };
  /** ms; 0 = no se cierra solo. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const ICONO: Record<StatusBadgeTone, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning",
  info: "info",
  neutral: "notifications",
};

const COLOR_ICONO: Record<StatusBadgeTone, string> = {
  success: "text-m3-success",
  error: "text-m3-error",
  warning: "text-m3-warning",
  info: "text-m3-info",
  neutral: "text-m3-on-surface-variant",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const siguiente = useRef(1);

  const cerrar = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback((t: ToastInput) => {
    const id = siguiente.current++;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-toast flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:w-[380px]"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => cerrar(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const tone = item.tone ?? "neutral";
  const [pausado, setPausado] = useState(false);
  const duracion = item.duration ?? (tone === "error" ? 10000 : 6000);

  useEffect(() => {
    if (pausado || duracion === 0) return;
    const t = setTimeout(onClose, duracion);
    return () => clearTimeout(t);
  }, [pausado, duracion, onClose]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-modal animate-in fade-in-0 slide-in-from-bottom-2 duration-base motion-reduce:animate-none"
    >
      <Icon name={ICONO[tone]} size={22} filled className={cn("mt-px shrink-0", COLOR_ICONO[tone])} />
      <div className="min-w-0 flex-1">
        <p className="font-label text-label-lg text-m3-on-surface">{item.title}</p>
        {item.description && <p className="mt-0.5 font-body text-body-sm text-m3-on-surface-variant">{item.description}</p>}
        {item.action && (
          <Link
            href={item.action.href}
            download={item.action.download || undefined}
            prefetch={false}
            onClick={onClose}
            className="mt-2 inline-flex items-center gap-1 font-label text-label-md font-semibold text-m3-primary hover:underline"
          >
            {item.action.label}
            <Icon name="arrow_forward" size={16} />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="-m-1 rounded-sm p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/** Devuelve `toast(...)`; fuera del provider no hace nada, para no romper pantallas sueltas. */
export function useToast() {
  const ctx = useContext(ToastContext);
  return useMemo(() => ctx ?? (() => undefined), [ctx]);
}
