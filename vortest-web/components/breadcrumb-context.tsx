"use client";

/**
 * Segmentos extra del breadcrumb superior (ScopeBarWithContext), en el
 * mismo espíritu que MobileNavProvider/ProjectProvider: una pantalla anidada
 * (p. ej. /casos/[casoId]) vive lejos del header en el árbol, así que
 * empuja sus segmentos ("Script", el nombre del caso...) vía contexto en
 * vez de que el header intente adivinarlos a partir de la URL.
 */
import { createContext, useCallback, useContext, useState, useMemo, type ReactNode } from "react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  extra: BreadcrumbSegment[];
  /** true cuando la pantalla define la ruta completa (Espacio › Proyecto › Caso…) en vez de sumar a la sección del menú. */
  reemplazaBase: boolean;
  setExtra: (segments: BreadcrumbSegment[], opciones?: { reemplazarBase?: boolean }) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ extra: BreadcrumbSegment[]; reemplazaBase: boolean }>({ extra: [], reemplazaBase: false });
  const setExtra = useCallback(
    (segments: BreadcrumbSegment[], opciones?: { reemplazarBase?: boolean }) =>
      setEstado({ extra: segments, reemplazaBase: Boolean(opciones?.reemplazarBase) }),
    [],
  );
  const value = useMemo(() => ({ ...estado, setExtra }), [estado, setExtra]);
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbExtra(): BreadcrumbContextValue {
  const context = useContext(BreadcrumbContext);
  if (context === undefined) {
    throw new Error("useBreadcrumbExtra must be used within a BreadcrumbProvider");
  }
  return context;
}
