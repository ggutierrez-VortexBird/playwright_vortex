'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Page title — rendered as h1 with font-headline */
  title: string;
  /** Optional breadcrumb trail rendered above the title */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Optional badge rendered inline with the title (e.g. "6 miembros") */
  badge?: { value: number | string; label: string };
  /** Contextual sub-line below the title (e.g. "Espacio · Proyecto · Contexto") */
  subtitle?: ReactNode;
  /** Longer descriptive text below the subtitle */
  description?: string;
  /** Slot for CTA buttons aligned to the right */
  actions?: ReactNode;
  /** 'default' = border-b + bg-m3-surface; 'flat' = no border, no bg */
  variant?: 'default' | 'flat';
  className?: string;
}

/**
 * Canonical page header — resolves Issue #3 (alta): 5 pages with inconsistent
 * hand-rolled headers. Anatomy:
 *   -mx-4 -mt-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3
 *   lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4
 *
 * Follows taste-brief Section 2 typography (Archivo) and Impeccable Directions.
 */
export function PageHeader({
  title,
  breadcrumbs,
  badge,
  subtitle,
  description,
  actions,
  variant = 'default',
  className = '',
}: PageHeaderProps) {
  const layoutClass = 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between';
  const containerClass =
    variant === 'flat'
      ? `${layoutClass} px-4 py-4 lg:px-6 lg:py-5 ${className}`
      : `${layoutClass} -mx-4 -mt-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4 ${className}`;

  return (
    <div className={containerClass.trimEnd()}>
      <div className="min-w-0 flex-1">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-1.5 flex items-center gap-1.5 font-label text-label-sm text-m3-on-surface-variant"
          >
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-m3-outline-variant" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-m3-primary hover:underline"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title row: h1 + optional badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-headline text-headline-lg text-m3-primary truncate">
            {title}
          </h1>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-m3-primary-container px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-inverse-on-surface">
              <span className="mr-1 font-semibold">{badge.value}</span>
              <span>{badge.label}</span>
            </span>
          )}
        </div>

        {/* Subtitle / description */}
        {subtitle && (
          <div className="mt-1 font-body text-body-md text-m3-on-surface-variant">{subtitle}</div>
        )}
        {description && (
          <p className={`font-body text-body-sm text-m3-on-surface-variant ${subtitle ? "" : "mt-1"}`}>
            {description}
          </p>
        )}
      </div>

      {/* Actions slot — aligned right */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
