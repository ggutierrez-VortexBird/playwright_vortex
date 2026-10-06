"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

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
    <ErrorState
      title="Error al cargar casos"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
