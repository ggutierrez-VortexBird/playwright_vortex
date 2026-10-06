"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function ProyectosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Proyectos page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar proyectos"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
