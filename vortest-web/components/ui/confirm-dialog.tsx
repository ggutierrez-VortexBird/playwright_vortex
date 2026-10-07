"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Etiqueta del elemento afectado, mostrada en una píldora (ej. "catastro · Alcaldía de Medellín"). */
  itemLabel?: string;
  itemColor?: string | null;
  confirmLabel?: string;
  /** Texto del botón mientras se confirma; por defecto "Eliminando…". */
  loadingLabel?: string;
  cancelLabel?: string;
  /** Ícono del encabezado; por defecto "delete". */
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Diálogo de confirmación para acciones destructivas: compone Modal (Escape, clic fuera, foco atrapado).
 * Cancelar recibe el foco inicial para que Enter no confirme por accidente.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  itemLabel,
  itemColor,
  confirmLabel = "Eliminar",
  loadingLabel = "Eliminando…",
  cancelLabel = "Cancelar",
  icon = "delete",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-dialog-title" className="max-w-md">
      <div className="p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-m3-error-container">
          <Icon name={icon} size={26} className="text-m3-error" />
        </div>
        <h3 id="confirm-dialog-title" className="mt-4 font-headline text-headline-md text-m3-on-surface">
          {title}
        </h3>
        <p id="confirm-dialog-desc" className="mt-2 font-body text-body-sm text-m3-on-surface-variant">
          {description}
        </p>

        {itemLabel && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-m3-surface-container px-3 py-2.5">
            {itemColor && <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ backgroundColor: itemColor }} />}
            <span className="font-body text-body-sm font-semibold text-m3-on-surface">{itemLabel}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1" autoFocus disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={isLoading} loadingText={loadingLabel} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
