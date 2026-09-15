"use client";

/**
 * RecordingGuide — tarjeta de guía + estado del servicio del grabador,
 * columna derecha del modo grabador.
 *
 * Look & feel: réplica de las tarjetas "Guía durante la grabación" y
 * "Estado del Servicio Local" del mockup
 * documentacion/referencias-diseño/cambios/grabador.html.
 */
export interface RecordingGuideProps {
  connState: "connecting" | "live" | "reconnecting" | "error" | "closed";
}

const STEPS = [
  {
    n: 1,
    color: "bg-m3-inverse-surface text-m3-inverse-on-surface",
    title: "Interactúa con naturalidad",
    desc: "Navega, escribe en los campos y haz clic en los enlaces dentro de la ventana dedicada de pruebas.",
  },
  {
    n: 2,
    color: "bg-m3-info text-white",
    title: "Agrega validaciones clave",
    desc: "Usa las opciones de la barra de Playwright codegen para verificar textos o visibilidad.",
  },
  {
    n: 3,
    color: "bg-m3-success text-white",
    title: "Finaliza cuando estés listo",
    desc: 'Haz clic en "Detener y procesar prueba" aquí o simplemente cierra la ventana del navegador.',
  },
];

const SERVICE_LABEL: Record<RecordingGuideProps["connState"], { label: string; dot: string; text: string }> = {
  live: { label: "Activo", dot: "bg-m3-success", text: "text-m3-success bg-m3-success-container" },
  connecting: { label: "Conectando", dot: "bg-amber-500", text: "text-m3-secondary bg-m3-secondary-container" },
  reconnecting: { label: "Reconectando", dot: "bg-amber-500", text: "text-m3-secondary bg-m3-secondary-container" },
  error: { label: "Con errores", dot: "bg-m3-error", text: "text-m3-error bg-m3-error-container" },
  closed: { label: "Desconectado", dot: "bg-m3-on-surface-variant", text: "text-m3-on-surface-variant bg-m3-surface-container-high" },
};

export function RecordingGuide({ connState }: RecordingGuideProps) {
  const service = SERVICE_LABEL[connState];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-m3-outline-variant pb-3">
          <h3 className="flex items-center gap-2 font-headline text-headline-sm text-m3-on-surface">
            <span className="material-symbols-outlined text-[18px] text-m3-info">help</span>
            Guía durante la grabación
          </h3>
          <span className="rounded bg-m3-info-container px-2 py-0.5 font-label text-label-sm font-semibold text-m3-info">
            3 pasos clave
          </span>
        </div>
        <ol className="space-y-4">
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-label text-label-sm font-semibold ${step.color}`}
              >
                {step.n}
              </div>
              <div>
                <h4 className="font-label text-label-md font-semibold text-m3-on-surface">{step.title}</h4>
                <p className="mt-0.5 font-body text-body-sm leading-normal text-m3-on-surface-variant">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${service.dot}`} />
            <div>
              <p className="font-label text-label-sm font-semibold text-m3-on-surface">Servicio de grabación</p>
              <p className="font-body text-body-sm text-m3-on-surface-variant">Conexión con el recorder-worker</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-label text-label-sm font-semibold ${service.text}`}>
            {service.label}
          </span>
        </div>
      </div>
    </div>
  );
}
