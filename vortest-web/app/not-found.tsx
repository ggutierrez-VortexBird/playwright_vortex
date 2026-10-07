import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-m3-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Logo variant="light" className="mx-auto h-auto w-36" />
        <p className="font-wide mt-10 font-headline text-[72px] font-bold leading-none tracking-tight text-m3-primary" aria-hidden="true">
          404
        </p>
        <h1 className="mt-4 font-headline text-headline-lg text-m3-on-surface">No encontramos esta página</h1>
        <p className="mt-2 font-body text-body-md text-m3-on-surface-variant">
          El enlace puede estar mal escrito, o el caso, la ejecución o el proyecto ya no existen o no tienes acceso a ellos.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" icon="home">
            Ir al inicio
          </ButtonLink>
          <ButtonLink href="/ejecuciones" variant="secondary" icon="play_circle">
            Ver ejecuciones
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
