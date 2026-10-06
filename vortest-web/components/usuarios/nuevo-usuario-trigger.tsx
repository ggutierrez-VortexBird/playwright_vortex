"use client";

import { Button } from "@/components/ui/button";

/**
 * Client-only trigger for the "Nuevo usuario" action in the PageHeader.
 * Extracted because Server Components cannot pass event handlers as props
 * (e.g. an inline onClick on <Button>) — React throws
 * "Event handlers cannot be passed to Client Component props" otherwise.
 * Dispatches a CustomEvent that UsuariosClient listens for to open its modal.
 */
export function NuevoUsuarioTrigger() {
  return (
    <Button
      variant="primary"
      className="inline-flex items-center gap-2"
      onClick={() => {
        document.dispatchEvent(new CustomEvent("open-create-usuario-modal"));
      }}
    >
      <span className="material-symbols-outlined text-[16px]">add</span>
      Nuevo usuario
    </Button>
  );
}
