"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ErrorBoundaryViewProps {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}

/** Vista común de los error.tsx: en producción `error.message` es genérico y en inglés, así que no se muestra. */
export function ErrorBoundaryView({ title, error, reset }: ErrorBoundaryViewProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-8 max-w-lg rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-m3-error-container text-m3-error">
        <Icon name="error" size={24} />
      </div>
      <h2 className="font-headline text-headline-md text-m3-on-surface">{title}</h2>
      <p className="mt-2 font-body text-body-md text-m3-on-surface-variant">
        Puede ser un problema momentáneo. Reintenta; si sigue pasando, comparte el código de soporte con el equipo.
      </p>
      {error.digest && (
        <p className="mt-3 font-body text-body-sm text-m3-on-surface-variant">
          Código de soporte: <code className="rounded-sm bg-m3-surface-container-high px-1.5 py-0.5 font-mono-code text-label-sm text-m3-on-surface">{error.digest}</code>
        </p>
      )}
      {process.env.NODE_ENV !== "production" && error.message && (
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-m3-surface-container p-3 text-left font-mono-code text-label-sm text-m3-on-surface-variant">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button icon="refresh" onClick={reset}>
          Reintentar
        </Button>
        <ButtonLink href="/" variant="secondary" icon="home">
          Ir al inicio
        </ButtonLink>
      </div>
    </div>
  );
}
