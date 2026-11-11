"use client";

import { useMobileNav } from "@/components/mobile-nav-context";

/** Botón hamburguesa del header, visible solo por debajo de `md:`. */
export function MobileMenuButton() {
  const { toggle } = useMobileNav();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Abrir menú de navegación"
      className="flex h-9 w-9 items-center justify-center rounded-full text-m3-on-surface-variant transition hover:bg-m3-surface-container md:hidden"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[22px]">menu</span>
    </button>
  );
}
