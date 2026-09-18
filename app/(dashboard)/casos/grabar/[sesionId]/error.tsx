"use client";

import { ErrorState } from "@/components/ui/error-state";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SesionError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 -mt-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Grabación</h2>
      </div>
      <ErrorState message={error.message} onRetry={reset} />
      {/* ErrorState no soporta una segunda acción — se mantiene "Volver a
          casos" como elemento aparte, tal como pedía el plan aprobado. */}
      <div className="flex justify-center">
        <a
          href="/casos"
          className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high"
        >
          Volver a casos
        </a>
      </div>
    </div>
  );
}
