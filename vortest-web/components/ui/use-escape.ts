"use client";

import { useEffect } from "react";

/** Llama `alPresionar` con Escape mientras `activo` sea true (menús, cajones, desplegables). */
export function useEscape(activo: boolean, alPresionar: () => void) {
  useEffect(() => {
    if (!activo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") alPresionar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activo, alPresionar]);
}
