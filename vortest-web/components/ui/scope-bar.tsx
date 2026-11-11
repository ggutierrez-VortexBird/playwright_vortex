interface ScopeBarProps {
  espacioNombre: string;
  proyectoNombre?: string;
  espacioColor?: string | null;
}

/** Indicador del Espacio y Proyecto activos como breadcrumb contextual. */
export function ScopeBar({ espacioNombre, proyectoNombre, espacioColor }: ScopeBarProps) {
  // Sin proyecto activo, muestra solo el espacio
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
      <span className="text-m3-on-surface-variant" aria-hidden="true">
        /
      </span>
      <span className="font-label text-label-md font-medium text-m3-primary truncate">
        {proyectoNombre}
      </span>
    </div>
  );
}
