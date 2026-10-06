"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function ProyectoCasosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Proyecto casos page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar casos del proyecto"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
