"use client";

interface RecToolbarProps {
  /** All actions in this toolbar are stubs for HU-G5..G7 — accept
   *  the `disabled` flag so the visual disabled state matches the
   *  live connection state without forcing parents to know about
   *  each individual tool. */
  disabled?: boolean;
}

/**
 * Floating toolbar centered at the bottom of the browser canvas.
 *
 * Visual fidelity: `fase2/mockups/grabar-test.html` lines 254-269.
 *
 * Per spec: only "Señalar elemento" is visually prominent (secondary-
 * container filled). The other 3 buttons (Verificar / Parámetro /
 * Pausar) are icon-only and rendered disabled since their actions land
 * in HU-G5..G7. Detener is NOT in this toolbar — it lives in the
 * grabador-topbar per mockup lines 220-222.
 */
export function RecToolbar({ disabled: _disabled }: RecToolbarProps) {
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-m3-surface-container-lowest border border-m3-outline-variant shadow-lg rounded-xl px-2 py-2 flex items-center gap-1 z-20"
      data-testid="rec-toolbar"
    >
      {/* Primary action — Señalar elemento */}
      <button
        type="button"
        disabled
        title="Señalar elemento — wired en HU-G5"
        data-testid="tool-senalar"
        className="flex items-center gap-2 bg-m3-secondary-container text-m3-on-secondary-container hover:bg-m3-secondary-fixed px-4 py-2 rounded-lg font-label text-label-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[18px]">touch_app</span>
        <span>Señalar elemento</span>
      </button>

      {/* Vertical divider */}
      <div
        className="w-px h-8 bg-m3-outline-variant mx-2"
        aria-hidden="true"
      />

      {/* Icon-only buttons — disabled stubs for HU-G5..G7 */}
      <button
        type="button"
        disabled
        title="Agregar verificación — wired en HU-G6"
        data-testid="tool-verificar"
        className="flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[20px]">fact_check</span>
      </button>
      <button
        type="button"
        disabled
        title="Convertir en parámetro — wired en HU-G7"
        data-testid="tool-parametro"
        className="flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[20px]">data_object</span>
      </button>
      <button
        type="button"
        disabled
        title="Pausar grabación — wired en HU-G7"
        data-testid="tool-pausar"
        className="flex items-center justify-center text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary w-10 h-10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[20px]">pause</span>
      </button>
    </div>
  );
}
