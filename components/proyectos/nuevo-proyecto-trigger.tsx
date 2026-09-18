"use client";

import { Button } from "@/components/ui/button";

/** Botón "Nuevo Proyecto" para el header de /espacios/[id]/proyectos — vive en un
 *  Server Component, así que dispara un evento en vez de manejar estado directamente. */
export function NuevoProyectoTrigger() {
  return (
    <Button
      variant="primary"
      className="inline-flex items-center gap-2"
      onClick={() => document.dispatchEvent(new CustomEvent("open-create-proyecto-modal"))}
    >
      <span className="material-symbols-outlined text-[16px]">add</span>
      Nuevo Proyecto
    </Button>
  );
}
