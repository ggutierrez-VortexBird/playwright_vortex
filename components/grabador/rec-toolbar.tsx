"use client";

interface RecToolbarProps {
  onStop: () => void;
  disabled: boolean;
}

/**
 * Toolbar inferior con 4 botones. Las acciones wired en HUs siguientes
 * (HU-G5..G7). En HU-G1 solo "Detener" está activo (cierra el WS).
 */
export function RecToolbar({ onStop, disabled }: RecToolbarProps) {
  return (
    <div className="vp-rec-toolbar" data-testid="rec-toolbar">
      <button className="vp-tool" disabled title="Sealizar elemento — wired en HU-G5">
        <span className="vp-tool-icon">🎯</span>
        <span className="vp-tool-label">Sealizar</span>
      </button>
      <button className="vp-tool" disabled title="Agregar verificación — wired en HU-G6">
        <span className="vp-tool-icon">⚑</span>
        <span className="vp-tool-label">Verificar</span>
      </button>
      <button className="vp-tool" disabled title="Convertir en parámetro — wired en HU-G7">
        <span className="vp-tool-icon">⊕</span>
        <span className="vp-tool-label">Parámetro</span>
      </button>
      <button className="vp-tool" disabled title="Pausar — wired en HU-G7">
        <span className="vp-tool-icon">⏸</span>
        <span className="vp-tool-label">Pausar</span>
      </button>
      <button
        className="vp-tool vp-tool-stop"
        onClick={onStop}
        disabled={disabled}
        data-testid="stop-button"
      >
        <span className="vp-tool-icon">■</span>
        <span className="vp-tool-label">Detener</span>
      </button>
    </div>
  );
}