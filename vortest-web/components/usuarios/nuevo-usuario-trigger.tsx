"use client";

import { Button } from "@/components/ui/button";

/** Disparador cliente de "Nuevo usuario": emite un CustomEvent que UsuariosClient escucha, porque un Server Component no pasa handlers. */
export function NuevoUsuarioTrigger() {
  return (
    <Button
      variant="primary"
      className="inline-flex items-center gap-2"
      onClick={() => {
        document.dispatchEvent(new CustomEvent("open-create-usuario-modal"));
      }}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
      Nuevo usuario
    </Button>
  );
}
