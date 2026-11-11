import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  /** CTA principal */
  action?: ReactNode;
  /** Contenido de onboarding bajo el CTA (p. ej. guía de 3 pasos) */
  onboarding?: ReactNode;
  /** Acción secundaria opcional (enlace, texto de ayuda) */
  secondaryAction?: { label: string; onClick: () => void };
}

/** Estado vacío canónico: ilustración útil + CTA, sin íconos de error. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  onboarding,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-m3-surface-container-high text-m3-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[24px]">
          {icon}
        </span>
      </div>

      <h3 className="font-headline text-headline-sm text-m3-on-surface">{title}</h3>
      {description && (
        <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">{description}</p>
      )}

      {action && <div className="mt-4">{action}</div>}

      {onboarding && <div className="mt-6">{onboarding}</div>}

      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="mt-3 font-label text-label-md text-m3-secondary hover:underline"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
