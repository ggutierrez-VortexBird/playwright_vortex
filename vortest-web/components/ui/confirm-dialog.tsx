"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Etiqueta del elemento afectado, mostrada en una píldora (ej. "catastro · Alcaldía de Medellín"). */
  itemLabel?: string;
  itemColor?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Diálogo de confirmación compartido — compone el overlay canónico de
 * Modal (Escape/click-outside) en vez de duplicar su propio backdrop.
 * Los botones de footer son a propósito de ancho igual (flex-1), distinto
 * del alineado por defecto que usan los formularios vía Modal — es
 * intencional para confirm/cancel, no un descuido.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  itemLabel,
  itemColor,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-dialog-title" className="max-w-md">
      <div className="p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-m3-danger-container">
          <span className="material-symbols-outlined text-[26px] text-m3-error">delete</span>
        </div>
        <h3 id="confirm-dialog-title" className="mt-4 font-headline text-headline-md text-m3-on-surface">
          {title}
        </h3>
        <p className="mt-2 font-body text-body-sm text-m3-on-surface-variant">{description}</p>

        {itemLabel && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-m3-surface-container px-3 py-2.5">
            {itemColor && (
              <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ backgroundColor: itemColor }} />
            )}
            <span className="font-body text-body-sm font-semibold text-m3-on-surface">{itemLabel}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isLoading} className="flex-1">
            {isLoading ? "Eliminando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
