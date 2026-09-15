'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="font-headline text-headline-md font-semibold text-m3-error">Error al cargar ejecuciones</div>
      <div className="font-body text-body-sm text-m3-on-surface-variant">{error.message}</div>
      <button
        onClick={reset}
        className="rounded bg-m3-primary px-4 py-2 font-label text-label-md text-m3-on-primary hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  )
}
