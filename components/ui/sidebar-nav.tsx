"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";

export interface SidebarNavItem {
  /** Ruta destino (e.g. "/casos"). Se compara contra el primer segmento del layout. */
  href: string;
  /** Etiqueta visible. */
  label: string;
  /** Nombre del icono Material Symbols Outlined (e.g. "fact_check"). */
  icon: string;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
}

/**
 * Sidebar nav primaria del dashboard.
 *
 * - Detecta la sección activa leyendo el primer segmento del layout actual
 *   (vía `useSelectedLayoutSegments`), por lo que rutas anidadas como
 *   `/proyectos/[id]/casos` siguen marcando "Proyectos" como activa.
 * - Marca el item activo con `aria-current="true"` y el borde/fondo M3
 *   (`border-m3-secondary-container`, `bg-white/5`) que usa el mockup de
 *   referencia (fase2/mockups/nuevo-caso-script.html).
 */
export function SidebarNav({ items }: SidebarNavProps): ReactNode {
  const segments = useSelectedLayoutSegments();
  const activeSection = segments[0] ?? "";

  return (
    <>
      {items.map((item) => {
        const section = item.href.replace(/^\//, "");
        const isActive = section === activeSection;

        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "flex items-center gap-3 rounded-r px-3.5 py-2.5 font-body text-body-md font-semibold text-m3-on-primary border-l-4 border-m3-secondary-container bg-white/5 transition-colors"
                : "flex items-center gap-3 rounded-r px-3.5 py-2.5 font-body text-body-md text-m3-on-primary-container/80 border-l-4 border-transparent transition-colors hover:bg-white/5 hover:text-m3-on-primary"
            }
          >
            <span
              className="material-symbols-outlined shrink-0 text-[20px]"
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        );
      })}
    </>
  );
}
