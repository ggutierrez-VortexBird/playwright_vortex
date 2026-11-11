"use client";

import { Button } from "@/components/ui/button";

/** Botón "Nuevo Proyecto" del header; dispara un evento porque vive en un Server Component. */
export function NuevoProyectoTrigger() {
  return (
    <Button
      variant="primary"
      className="inline-flex items-center gap-2"
      onClick={() => document.dispatchEvent(new CustomEvent("open-create-proyecto-modal"))}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
      Nuevo Proyecto
    </Button>
  );
}
