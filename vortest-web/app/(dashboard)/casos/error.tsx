"use client";

import { ErrorBoundaryView } from "@/components/ui/error-boundary-view";

export default function ErrorDeSeccion({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryView title="No pudimos cargar los casos" error={error} reset={reset} />;
}
