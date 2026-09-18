'use client'

import { ErrorState } from "@/components/ui/error-state"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState title="Error al cargar ejecuciones" message={error.message} onRetry={reset} />
  )
}
