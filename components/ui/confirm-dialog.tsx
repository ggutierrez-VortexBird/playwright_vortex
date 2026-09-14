"use client";

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
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-m3-surface-container-lowest p-8 text-center shadow-2xl">
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
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-m3-outline-variant py-2.5 font-label text-label-lg font-semibold text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-m3-error py-2.5 font-label text-label-lg font-semibold text-m3-on-error transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
