"use client";

/**
 * Panel derecho de pasos grabados. En HU-G1 está vacío (HU-G3 implementa
 * el traductor de eventos DOM a pasos legibles). Mantiene el layout para
 * que las próximas HUs no rompan la UI.
 */
export function PasoPanel() {
  return (
    <div className="vp-paso-panel" data-testid="paso-panel">
      <header className="vp-paso-head">
        <h3>Pasos grabados</h3>
        <span className="vp-paso-count">0</span>
      </header>
      <div className="vp-paso-empty">
        <div className="stamp">
          <span className="ink" />
          EN VIVO
        </div>
        <p>
          Los pasos aparecerán aquí cuando se implemente el traductor de
          eventos DOM (HU-G3). Esta sesión queda en modo observador.
        </p>
      </div>
    </div>
  );
}