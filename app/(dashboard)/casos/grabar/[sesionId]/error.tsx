"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SesionError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Grabación</h2>
      </div>
      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 rounded-md bg-m3-error-container/10 p-3 font-body text-body-sm text-m3-error">
          <strong>Error:</strong> {error.message}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90"
          >
            Reintentar
          </button>
          <a
            href="/casos"
            className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high"
          >
            Volver a casos
          </a>
        </div>
      </div>
    </div>
  );
}