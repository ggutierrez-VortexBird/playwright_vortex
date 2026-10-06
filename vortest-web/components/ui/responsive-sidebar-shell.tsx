"use client";

import type { ReactNode } from "react";
import { useMobileNav } from "@/components/mobile-nav-context";

/**
 * Envoltorio responsive del `<aside>` del dashboard:
 *  - `lg:` y superior — igual que siempre (sticky, w-60, siempre visible).
 *  - `md:`–`lg-1` (tablet) — riel de solo iconos (w-[72px]), siempre visible,
 *    sin necesidad de estado (el colapso es puro CSS, ver layout.tsx).
 *  - `<md` (móvil) — oculto por defecto; se abre como cajón superpuesto con
 *    backdrop, controlado por `MobileNavProvider`.
 */
export function ResponsiveSidebarShell({ children }: { children: ReactNode }) {
  const { open, close } = useMobileNav();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        className={`sticky top-0 z-40 flex h-screen flex-none flex-col bg-m3-primary-container text-m3-on-primary transition-transform duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-64 md:z-20 md:w-[72px] md:translate-x-0 lg:w-60 ${
          open ? "" : "max-md:-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
