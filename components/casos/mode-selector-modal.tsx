"use client";

/**
 * ModeSelectorModal — HU-G20
 *
 * Modal que se abre desde el botón "Nuevo caso" de la página /casos.
 * Presenta 2 tarjetas lado a lado (Grabar Acción / Subir Script Playwright)
 * que eligen el modo de creación del caso. Click en una tarjeta navega a
 * la ruta correspondiente.
 *
 * Diseño: replica el mockup fase2/mockups/nuevo-caso-pruebas.html.
 * Accesibilidad:
 *   - role="dialog" + aria-modal
 *   - Cerrar con Escape, click en backdrop, o botón "Cancelar"
 *   - focus trap liviano: el primer botón enfocable toma foco al abrirse
 *
 * Nota: el "Video" del mockup original queda fuera del MVP (decisión de
 * Gustavo el 2026-09-01) — sólo se implementan los 2 modos.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface ModeSelectorModalProps {
  /** Cuando se setea, abre el modal. */
  open: boolean;
  /** Cierra el modal (Escape, click-outside, Cancelar). */
  onClose: () => void;
  /** proyectoId opcional para propagar a la ruta de Grabar. */
  proyectoId?: string;
}

interface ModeCard {
  id: "grabar" | "subir";
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  iconFg: string;
  href: string;
  ctaLabel: string;
}

export function ModeSelectorModal({
  open,
  onClose,
  proyectoId,
}: ModeSelectorModalProps) {
  const router = useRouter();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  // Escape cierra el modal.
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mover foco al primer botón cuando abre.
  useEffect(() => {
    if (open) {
      // Pequeño timeout para asegurar que el botón está en el DOM.
      const t = window.setTimeout(() => firstButtonRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const qs = proyectoId ? `?proyectoId=${encodeURIComponent(proyectoId)}` : "";

  const cards: ModeCard[] = [
    {
      id: "grabar",
      title: "Grabar Acción (No-Code)",
      description: "Crea pasos interactuando con el navegador en vivo.",
      icon: "videocam",
      iconBg: "bg-amber-100",
      iconFg: "text-amber-600",
      href: `/casos/grabar/nueva${qs}`,
      ctaLabel: "Iniciar grabación",
    },
    {
      id: "subir",
      title: "Subir Script Playwright",
      description: "Sube archivos .spec.ts o .test.ts existentes.",
      icon: "terminal",
      iconBg: "bg-slate-100",
      iconFg: "text-slate-700",
      href: "#create",
      ctaLabel: "Subir archivo",
    },
  ];

  function handleCardClick(card: ModeCard) {
    if (card.id === "subir") {
      // La opción "Subir Script" delega en el handler existente
      // (CreateCasoForm). Cerramos el modal y emitimos un evento global
      // que CasosClient escucha para abrir el form.
      onClose();
      window.dispatchEvent(new CustomEvent("acta:open-create-caso-form"));
      return;
    }
    onClose();
    router.push(card.href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selector-title"
      data-testid="mode-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Click en el backdrop (no en el contenido) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2
            id="mode-selector-title"
            className="text-xl font-semibold text-gray-900"
          >
            ¿Cómo quieres crear tu caso de prueba?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Elegí un modo para empezar. Podés cambiar más tarde.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, idx) => (
            <button
              key={card.id}
              ref={idx === 0 ? firstButtonRef : undefined}
              type="button"
              onClick={() => handleCardClick(card)}
              data-testid={`mode-selector-card-${card.id}`}
              className="group flex flex-col items-center text-center p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-amber-400 hover:ring-2 hover:ring-amber-200 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <div
                className={`w-16 h-16 rounded-full ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}
              >
                <span
                  className={`material-symbols-outlined text-[40px] ${card.iconFg}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  {card.icon}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{card.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 group-hover:text-amber-800">
                {card.ctaLabel}
                <span
                  className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            data-testid="mode-selector-cancel"
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded font-medium text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
