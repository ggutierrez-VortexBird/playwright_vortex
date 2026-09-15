import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { decodeDraft } from "@/lib/grabador/draft";
import { PrepararGrabacionClient } from "@/components/grabador/preparar-grabacion-client";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Pantalla intermedia entre "Nueva grabación" (el formulario, que solo
 * junta datos) y la sesión en vivo. Acá el usuario decide arrancar de
 * verdad — recién al hacer click en "Iniciar grabación"
 * (`PrepararGrabacionClient`) se crea la `SesionGrabacion` y se abre el
 * navegador real. La autorización de proyecto/credencial/caso padre ya la
 * hace `POST /api/grabador/sesiones` al arrancar, así que acá solo
 * validamos sesión de usuario + que el borrador decodifique.
 */
export default async function PrepararGrabacionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const draft = decodeDraft(sp);
  if (!draft) {
    return (
      <div className="flex flex-col gap-6">
        <div className="-mx-6 -mt-6 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
          <h2 className="font-headline text-headline-lg text-m3-primary">Nueva grabación</h2>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center font-body text-body-md text-m3-on-surface-variant shadow-sm">
          Faltan datos de la grabación. Vuelve a completar el formulario.
        </div>
      </div>
    );
  }

  return <PrepararGrabacionClient draft={draft} />;
}
