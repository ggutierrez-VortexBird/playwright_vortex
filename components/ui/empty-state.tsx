import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  /** Primary CTA — most important action */
  action?: ReactNode;
  /** Optional onboarding content embedded below the CTA (e.g. 3-step recorder guide) */
  onboarding?: ReactNode;
  /** Optional secondary action (e.g. secondary link, help text) */
  secondaryAction?: { label: string; onClick: () => void };
}

/**
 * Canonical empty state — teaches, does not just lament.
 * Follows taste-brief: no sad face, no error icon — only useful illustration + CTA.
 * Impeccable: layout (centred) + typeset (h3 headline, body text) + polish.
 *
 * Typography per taste-brief Section 2:
 *   - Headline: Archivo 600, headline-sm, text-m3-on-surface
 *   - Body: Archivo 400, body-md, text-m3-on-surface-variant
 */
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
      {/* Icon circle */}
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-m3-surface-container-high text-m3-on-surface-variant">
        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
          {icon}
        </span>
      </div>

      {/* Text block */}
      <h3 className="font-headline text-headline-sm text-m3-on-surface">{title}</h3>
      {description && (
        <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">{description}</p>
      )}

      {/* Primary action */}
      {action && <div className="mt-4">{action}</div>}

      {/* Onboarding content — embedded guide below CTA */}
      {onboarding && <div className="mt-6">{onboarding}</div>}

      {/* Secondary action */}
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
