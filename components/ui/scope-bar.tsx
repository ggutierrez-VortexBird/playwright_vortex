'use client';

interface ScopeBarProps {
  espacioNombre: string;
  espacioColor?: string | null;
}

export function ScopeBar({ espacioNombre, espacioColor }: ScopeBarProps) {
  return (
    <div className="scope-bar flex items-center gap-2 text-sm font-medium text-ink">
      {espacioColor && (
        <i
          className="scope-bar-icon"
          style={{ backgroundColor: espacioColor }}
          aria-hidden="true"
        />
      )}
      <span>{espacioNombre}</span>
    </div>
  );
}
