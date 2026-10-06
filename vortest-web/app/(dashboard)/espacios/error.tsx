"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function EspaciosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Espacios page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar espacios"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
