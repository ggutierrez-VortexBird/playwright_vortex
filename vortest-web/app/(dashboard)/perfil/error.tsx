"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function PerfilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Perfil page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar el perfil"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
