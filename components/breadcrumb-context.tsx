"use client";

/**
 * Segmentos extra del breadcrumb superior (ScopeBarWithContext), en el
 * mismo espíritu que MobileNavProvider/ProjectProvider: una pantalla anidada
 * (p. ej. /casos/[casoId]) vive lejos del header en el árbol, así que
 * empuja sus segmentos ("Script", el nombre del caso...) vía contexto en
 * vez de que el header intente adivinarlos a partir de la URL.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  extra: BreadcrumbSegment[];
  setExtra: (segments: BreadcrumbSegment[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [extra, setExtra] = useState<BreadcrumbSegment[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ extra, setExtra }}>
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
