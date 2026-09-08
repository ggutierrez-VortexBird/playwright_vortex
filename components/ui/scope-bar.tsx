'use client';

interface ScopeBarProps {
  espacioNombre: string;
  proyectoNombre?: string;
  espacioColor?: string | null;
}

export function ScopeBar({ espacioNombre, proyectoNombre, espacioColor }: ScopeBarProps) {
  // Hide scope-bar when no project is active (at project grid level)
  if (!proyectoNombre) {
    return null;
  }

  return (
    <div className="scope-bar flex items-center gap-2 font-body text-body-md font-medium text-m3-on-surface">
      {espacioColor && (
        <i
          className="scope-bar-icon"
          style={{ backgroundColor: espacioColor }}
          aria-hidden="true"
        />
      )}
      <span>{proyectoNombre}</span>
    </div>
  );
}
