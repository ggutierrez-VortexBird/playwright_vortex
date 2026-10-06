"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function UsuariosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Usuarios page error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Error al cargar usuarios"
      message={error.message || "Ocurrió un error inesperado."}
      onRetry={reset}
    />
  );
}
