"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMobileNav } from "@/components/mobile-nav-context";
import { useEscape } from "@/components/ui/use-escape";

/**
 * Envoltorio responsive del `<aside>` del dashboard:
 *  - `lg:` y superior — sticky, w-60, siempre visible.
 *  - `md:`–`lg-1` (tablet) — riel de solo íconos (w-[72px]), siempre visible.
 *  - `<md` (móvil) — cajón superpuesto; cerrado queda `inert` para que el teclado no recorra enlaces invisibles.
 */
export function ResponsiveSidebarShell({ children }: { children: ReactNode }) {
  const { open, close } = useMobileNav();
  const ref = useRef<HTMLElement>(null);
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const actualizar = () => setEsMovil(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);

  useEscape(open && esMovil, close);

  useEffect(() => {
    if (open && esMovil) ref.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open, esMovil]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-overlay bg-m3-scrim/55 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        ref={ref}
        aria-label="Navegación principal"
        inert={esMovil && !open ? true : undefined}
        className={`sticky top-0 z-modal flex h-screen flex-none flex-col bg-m3-primary-container text-white transition-transform duration-base ease-standard max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-64 md:z-sticky md:w-[72px] md:translate-x-0 lg:w-60 ${
          open ? "" : "max-md:-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
