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
      href: `/casos/grabar/nueva${qs}`,
      ctaLabel: "Iniciar grabación",
    },
    {
      id: "subir",
      title: "Subir Script Playwright",
      description: "Sube archivos .spec.ts o .test.ts existentes.",
      icon: "terminal",
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
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-2xl">
        <div className="border-b border-m3-outline-variant px-6 py-5">
          <h2
            id="mode-selector-title"
            className="font-headline text-headline-lg text-m3-primary"
          >
            ¿Cómo quieres crear tu caso de prueba?
          </h2>
          <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
            Elegí un modo para empezar. Podés cambiar más tarde.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          {cards.map((card, idx) => (
            <button
              key={card.id}
              ref={idx === 0 ? firstButtonRef : undefined}
              type="button"
              onClick={() => handleCardClick(card)}
              data-testid={`mode-selector-card-${card.id}`}
              className="group flex flex-col items-center rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center shadow-sm transition-all hover:border-m3-secondary hover:ring-2 hover:ring-m3-secondary-fixed/40 focus:outline-none focus:ring-2 focus:ring-m3-secondary"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-m3-secondary-fixed transition-transform group-hover:scale-105">
                <span
                  className="material-symbols-outlined text-[40px] text-m3-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  {card.icon}
                </span>
              </div>
              <h3 className="mb-2 font-headline text-headline-md text-m3-primary">
                {card.title}
              </h3>
              <p className="mb-4 font-body text-body-sm text-m3-on-surface-variant">
                {card.description}
              </p>
              <span className="inline-flex items-center gap-1 font-label text-label-md font-medium text-m3-secondary group-hover:text-m3-on-secondary-container">
                {card.ctaLabel}
                <span
                  className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end border-t border-m3-outline-variant bg-m3-surface-container px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            data-testid="mode-selector-cancel"
            className="rounded border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-2 font-label text-label-md text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container-high focus:outline-none focus:ring-2 focus:ring-m3-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
