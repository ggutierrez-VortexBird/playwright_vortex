import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { decodeDraft } from "@/lib/grabador/draft";
import { PrepararGrabacionClient } from "@/components/grabador/preparar-grabacion-client";
import { PageHeader } from "@/components/ui/page-header";


export const metadata: Metadata = { title: "Preparar grabación" };
interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Pantalla previa a la sesión en vivo: la sesión se crea al pulsar "Iniciar grabación". */
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
        <PageHeader
          title="Preparar grabación"
          breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Preparar" }]}
        />
        <div className="rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center font-body text-body-md text-m3-on-surface-variant shadow-sm">
          Faltan datos de la grabación. Vuelve a completar el formulario.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Listo para grabar"
        breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Preparar" }]}
      />
      <PrepararGrabacionClient draft={draft} />
    </div>
  );
}
