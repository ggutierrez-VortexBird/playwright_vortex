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
      <div className="text-[--stamp] font-semibold">Error al cargar ejecuciones</div>
      <div className="text-sm text-[--rule]">{error.message}</div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-[--client] text-white rounded hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  )
}
