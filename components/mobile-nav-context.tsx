"use client";

/**
 * Estado compartido del cajón de navegación en móvil (<md), en el mismo
 * espíritu que ProjectProvider: un botón hamburguesa en el header y el
 * `<aside>` viven en lugares distintos del árbol (ver
 * app/(dashboard)/layout.tsx), así que necesitan un estado común sin pasar
 * por props. En `md:` y superior el sidebar es siempre visible (riel o
 * completo) y este estado no se usa.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

interface MobileNavContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | undefined>(undefined);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileNavContext.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
        close: () => setOpen(false),
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavContextValue {
  const context = useContext(MobileNavContext);
  if (context === undefined) {
    throw new Error("useMobileNav must be used within a MobileNavProvider");
  }
  return context;
}
