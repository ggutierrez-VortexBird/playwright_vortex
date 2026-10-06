import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryHref?: string;
}

// Mismas clases que <Button variant="primary" /> — se duplican acá porque
// el retry por link necesita ser un <Link>, no un <button>, y Button no
// soporta "asChild".
const RETRY_LINK_CLASSNAMES =
  "inline-flex items-center justify-center rounded-md bg-m3-primary px-4 py-2.5 font-label text-label-md font-semibold text-m3-on-primary transition-colors hover:opacity-90";

/**
 * Estado de error canónico — mismo contenedor de card que EmptyState, pero
 * con ícono de error/advertencia y botón de reintentar (callback o link).
 */
export function ErrorState({
  title = "Algo salió mal",
  message,
  onRetry,
  retryHref,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-m3-error-container text-m3-error">
        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
          error
        </span>
      </div>
      <h3 className="font-headline text-headline-sm text-m3-on-surface">{title}</h3>
      {message && (
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">{message}</p>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button variant="primary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
      {!onRetry && retryHref && (
        <div className="mt-4">
          <Link href={retryHref} className={RETRY_LINK_CLASSNAMES}>
            Reintentar
          </Link>
        </div>
      )}
    </div>
  );
}
