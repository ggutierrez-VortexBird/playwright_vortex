'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SidebarNavItem } from '@/components/ui/sidebar-nav';
import { useBreadcrumbExtra, type BreadcrumbSegment } from '@/components/breadcrumb-context';

interface ScopeBarWithContextProps {
  items: SidebarNavItem[];
}

/**
 * Breadcrumb de "dónde estoy parado" en la app (Inicio, Espacios, Casos...),
 * derivado de la ruta actual — no del espacio/proyecto seleccionado (eso ya
 * lo muestran los switchers). Pantallas anidadas (p. ej. el detalle de un
 * caso) pueden agregar segmentos propios vía BreadcrumbProvider — ver
 * useBreadcrumbExtra. Cada segmento intermedio es clickeable; el último es
 * la ubicación actual.
 */
export function ScopeBarWithContext({ items }: ScopeBarWithContextProps) {
  const pathname = usePathname();
  const { extra, reemplazaBase } = useBreadcrumbExtra();
  const itemByHref = new Map(items.map((item) => [item.href.replace(/^\//, ''), item]));

  const segments = pathname.split('/').filter(Boolean);
  const matched: BreadcrumbSegment[] = segments
    .map((segment) => itemByHref.get(segment))
    .filter((item): item is SidebarNavItem => Boolean(item))
    .map((item) => ({ label: item.label, href: item.href }));

  const base: BreadcrumbSegment[] =
    matched.length > 0
      ? matched
      : [{ label: segments.length > 0 ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'Inicio' }];

  const crumbs = reemplazaBase ? extra : [...base, ...extra];

  return (
    <nav aria-label="Ubicación actual" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden font-label text-label-md">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          // En pantallas angostas sólo se ve la ubicación actual; el título de la página ya da el contexto.
          <span key={`${crumb.label}-${i}`} className={`min-w-0 items-center gap-1.5 ${isLast ? "flex" : "hidden md:flex"}`}>
            {i > 0 && (
              <span className="hidden text-m3-on-surface-variant md:inline" aria-hidden="true">
                /
              </span>
            )}
            {!isLast && crumb.href ? (
              <Link href={crumb.href} className="truncate rounded-sm text-m3-on-surface-variant hover:text-m3-primary hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'truncate font-medium text-m3-on-surface' : 'truncate text-m3-on-surface-variant'}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
