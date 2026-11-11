"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

export interface SidebarNavItem {
  /** Ruta destino (p. ej. "/casos"). Se compara contra el primer segmento del layout. */
  href: string;
  /** Etiqueta visible. */
  label: string;
  /** Nombre del icono Material Symbols Outlined (p. ej. "fact_check"). */
  icon: string;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
}

/** Navegación primaria del dashboard: la sección activa sale del primer segmento del layout, así que las rutas anidadas la mantienen marcada. */
export function SidebarNav({ items }: SidebarNavProps): ReactNode {
  const segments = useSelectedLayoutSegments();
  const activeSection = segments[0] ?? "";

  return (
    <>
      {items.map((item) => {
        const section = item.href.replace(/^\//, "");
        const isActive = section === activeSection;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "relative flex items-center gap-3 rounded-md px-3.5 py-2.5 focus-visible:outline-m3-secondary-container font-body text-body-md font-semibold text-white bg-white/10 transition-colors duration-fast ease-standard before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-m3-secondary-container md:justify-center lg:justify-start"
                : "flex items-center gap-3 rounded-md px-3.5 py-2.5 focus-visible:outline-m3-secondary-container font-body text-body-md text-m3-on-primary-container transition-colors duration-fast ease-standard hover:bg-white/5 hover:text-white md:justify-center lg:justify-start"
            }
          >
            <span aria-hidden="true"
              className={`material-symbols-outlined shrink-0 text-[20px] ${isActive ? "text-m3-secondary-container" : ""}`}
            >
              {item.icon}
            </span>
            <span className="md:hidden lg:inline">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
