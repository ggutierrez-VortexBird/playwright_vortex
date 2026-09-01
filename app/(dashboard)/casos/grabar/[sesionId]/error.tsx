"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SesionError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Grabación</h2>
      </div>
      <div className="card p-6">
        <div className="rounded-md bg-red-50 p-3 text-sm text-stamp mb-4">
          <strong>Error:</strong> {error.message}
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="btn btn-primary">
            Reintentar
          </button>
          <a href="/casos" className="btn">
            Volver a casos
          </a>
        </div>
      </div>
    </div>
  );
}