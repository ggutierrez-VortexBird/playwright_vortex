"use client";

/**
 * ModeSelectorModal — HU-G20
 *
 * Modal que se abre desde el botón "Nuevo caso" de la página /casos.
 * Paso 1 ("select"): 2 tarjetas lado a lado (Grabar Acción / Subir Script
 * Playwright) para elegir el modo de creación del caso — ninguna aparece
 * preseleccionada, el resaltado sigue al hover/foco de cada tarjeta.
 * Paso 2 ("subir" | "grabar"): el formulario correspondiente se embebe en
 * el mismo modal (no navega a otra pantalla). Un botón "Volver" arriba a la
 * derecha regresa al paso 1 sin cerrar el modal.
 *
 * Diseño: replica el mockup fase2/mockups/nuevo-caso-pruebas.html para el
 * paso 1. Accesibilidad:
 *   - role="dialog" + aria-modal
 *   - Cerrar con Escape, click en backdrop, o botón "Cancelar"
 *   - focus trap liviano: el primer botón enfocable toma foco al abrirse
 *
 * Nota: el "Video" del mockup original queda fuera del MVP (decisión de
 * Gustavo el 2026-09-01) — sólo se implementan los 2 modos.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateCasoForm } from "./create-caso-form";
import { NuevaGrabacionForm } from "@/components/grabador/nueva-grabacion-form";
import type { CredencialListItem } from "@/lib/grabador/types";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

export interface ModeSelectorModalProps {
  /** Cuando se setea, abre el modal. */
  open: boolean;
  /** Cierra el modal (Escape, click-outside, Cancelar). */
  onClose: () => void;
  /** proyectoId opcional: si viene, ambos flujos quedan fijados a ese proyecto. */
  proyectoId?: string;
  /** Lista de proyectos para elegir cuando no hay proyectoId fijo. */
  proyectos?: ProyectoOption[];
  /** Se dispara cuando un caso se crea con éxito (subir script), para refrescar el listado. */
  onCasoCreated?: () => void;
}

type Step = "select" | "grabar" | "subir";

interface ModeCard {
  id: "grabar" | "subir";
  title: string;
  description: string;
  icon: string;
  ctaLabel: string;
}

const CARDS: ModeCard[] = [
  {
    id: "grabar",
    title: "Grabar acción (No-Code)",
    description: "Crea pasos interactuando con el navegador en vivo.",
    icon: "videocam",
    ctaLabel: "Iniciar grabación",
  },
  {
    id: "subir",
    title: "Subir Script Playwright",
    description: "Sube archivos .spec.ts o .test.ts existentes.",
    icon: "upload",
    ctaLabel: "Subir archivo",
  },
];

export function ModeSelectorModal({
  open,
  onClose,
  proyectoId,
  proyectos,
  onCasoCreated,
}: ModeSelectorModalProps) {
  const router = useRouter();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [grabarProyectoId, setGrabarProyectoId] = useState(proyectoId ?? "");
  const [credenciales, setCredenciales] = useState<CredencialListItem[] | null>(null);
  const [loadingCred, setLoadingCred] = useState(false);

  // Al abrir (o al cambiar de proyecto fijo), siempre arranca en el paso 1.
  useEffect(() => {
    if (open) {
      setStep("select");
      setGrabarProyectoId(proyectoId ?? "");
      setCredenciales(null);
    }
  }, [open, proyectoId]);

  // Trae las credenciales del proyecto elegido para el paso "grabar".
  useEffect(() => {
    if (step !== "grabar" || !grabarProyectoId) {
      setCredenciales(null);
      return;
    }
    let cancelled = false;
    setLoadingCred(true);
    fetch(`/api/proyectos/${grabarProyectoId}/credenciales`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setCredenciales(data);
      })
      .catch(() => {
        if (!cancelled) setCredenciales([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCred(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, grabarProyectoId]);

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
    if (open && step === "select") {
      // Pequeño timeout para asegurar que el botón está en el DOM.
      const t = window.setTimeout(() => firstButtonRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, step]);

  if (!open) return null;

  function handleCardClick(card: ModeCard) {
    setStep(card.id);
  }

  const title =
    step === "select"
      ? "¿Cómo querés crear tu caso de prueba?"
      : step === "subir"
        ? "Subir Script Playwright"
        : "Grabar acción (No-Code)";

  const contentWidth = step === "select" ? "max-w-3xl" : step === "grabar" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selector-title"
      data-testid="mode-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Click en el backdrop (no en el contenido) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${contentWidth} overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-m3-outline-variant px-6 py-5">
          <div>
            <h2
              id="mode-selector-title"
              className="font-headline text-headline-lg text-m3-primary"
            >
              {title}
            </h2>
            {step === "select" && (
              <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
                Elegí un modo para empezar. Podés cambiar más tarde.
              </p>
            )}
          </div>
          {step !== "select" && (
            <button
              type="button"
              onClick={() => setStep("select")}
              data-testid="mode-selector-back"
              className="inline-flex shrink-0 items-center gap-1 font-label text-label-sm font-semibold text-m3-secondary transition-colors hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_back
              </span>
              Volver
            </button>
          )}
        </div>

        {step === "select" && (
          <>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              {CARDS.map((card, idx) => (
                <button
                  key={card.id}
                  ref={idx === 0 ? firstButtonRef : undefined}
                  type="button"
                  onClick={() => handleCardClick(card)}
                  data-testid={`mode-selector-card-${card.id}`}
                  className="group flex flex-col items-center rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center transition-all hover:border-m3-secondary hover:bg-m3-secondary-fixed/20 focus:outline-none focus-visible:border-m3-secondary focus-visible:bg-m3-secondary-fixed/20 focus-visible:ring-2 focus-visible:ring-m3-secondary"
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-m3-surface-container-high transition-all group-hover:scale-105 group-hover:bg-m3-secondary-container">
                    <span
                      className="material-symbols-outlined text-[32px] text-m3-on-surface-variant transition-colors group-hover:text-m3-on-surface"
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

            <div className="flex justify-end px-6 pb-6">
              <button
                type="button"
                onClick={onClose}
                data-testid="mode-selector-cancel"
                className="font-label text-label-md text-m3-on-surface-variant transition-colors hover:underline focus:outline-none"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {step === "subir" && (
          <div className="p-6">
            <CreateCasoForm
              embedded
              proyectoId={proyectoId}
              proyectos={proyectos}
              onSuccess={() => {
                onClose();
                onCasoCreated?.();
              }}
              onCancel={onClose}
            />
          </div>
        )}

        {step === "grabar" && (
          <div className="p-6">
            {!grabarProyectoId ? (
              <div className="flex flex-col gap-3">
                <label htmlFor="grabar-proyecto" className="font-label text-label-sm font-semibold text-m3-on-surface">
                  Proyecto
                </label>
                <select
                  id="grabar-proyecto"
                  value={grabarProyectoId}
                  onChange={(e) => setGrabarProyectoId(e.target.value)}
                  className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
                >
                  <option value="">Selecciona un proyecto</option>
                  {proyectos?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {p.espacioNombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : loadingCred || credenciales === null ? (
              <div className="py-8 text-center font-body text-body-md text-m3-on-surface-variant">
                Cargando…
              </div>
            ) : (
              <NuevaGrabacionForm
                embedded
                proyectoId={grabarProyectoId}
                credenciales={credenciales}
                onCancel={() => setStep("select")}
                onSuccess={(sessionId) => {
                  onClose();
                  router.push(`/casos/grabar/${sessionId}`);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
