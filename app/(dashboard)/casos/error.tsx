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
    <div className="rounded-lg border border-stamp bg-red-50 p-8 text-center">
      <h2 className="text-lg font-semibold text-stamp">Error al cargar casos</h2>
      <p className="mt-2 text-sm text-ink-3">
        {error.message || "Ocurrió un error inesperado."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-rule-soft"
      >
        Reintentar
      </button>
    </div>
  );
}
