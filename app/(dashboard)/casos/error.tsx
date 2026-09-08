"use client";

import { useEffect } from "react";

export default function CasosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Casos page error:", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-m3-error bg-m3-error-container/10 p-8 text-center">
      <h2 className="text-lg font-semibold text-m3-error">Error al cargar casos</h2>
      <p className="mt-2 text-sm text-m3-on-surface-variant">
        {error.message || "Ocurrió un error inesperado."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-2 text-sm font-medium text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
      >
        Reintentar
      </button>
    </div>
  );
}
