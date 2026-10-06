"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function CredencialesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Credenciales page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar credenciales"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
