'use client';

interface ScopeBarProps {
  espacioNombre: string;
  proyectoNombre?: string;
  espacioColor?: string | null;
}

/**
 * Scope indicator — shows the active Espacio + Proyecto as a contextual breadcrumb.
 * Mandatory on all screens except /login (PRD Criterio #2).
 *
 * Anatomy:
 *   - Small left-border client-band accent in espacioColor
 *   - espacioNombre in text-m3-on-surface-variant
 *   - Chevron separator
 *   - proyectoNombre in text-m3-primary (emphasized as active)
 *
 * Impeccable: layout (always visible) + colorize (semantic emphasis).
 */
export function ScopeBar({ espacioNombre, proyectoNombre, espacioColor }: ScopeBarProps) {
  // If no project is active, show the espacio only (e.g. project listing)
  if (!proyectoNombre) {
    return (
      <div className="relative flex items-center gap-2 overflow-hidden">
        {espacioColor && (
          <i
            className="scope-bar-icon"
            style={{ backgroundColor: espacioColor }}
            aria-hidden="true"
          />
        )}
        <span className="font-label text-label-md text-m3-on-surface-variant truncate">
          {espacioNombre}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 overflow-hidden">
      {/* Left accent border — espacio color */}
      {espacioColor && (
        <i
          className="scope-bar-icon"
          style={{ backgroundColor: espacioColor }}
          aria-hidden="true"
        />
      )}
      {/* Breadcrumb: espacio > proyecto */}
      <span className="font-label text-label-md text-m3-on-surface-variant truncate">
        {espacioNombre}
      </span>
      <span className="text-m3-on-surface-variant" aria-hidden="true">
        /
      </span>
      <span className="font-label text-label-md font-medium text-m3-primary truncate">
        {proyectoNombre}
      </span>
    </div>
  );
}
