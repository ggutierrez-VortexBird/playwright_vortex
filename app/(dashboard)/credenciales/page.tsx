import { redirect } from "next/navigation";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CredencialesPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  // Credenciales es 100% exclusivo del superadmin — admin y tester no la
  // ven ni la usan.
  if (usuario?.rol !== "superadmin") {
    redirect("/proyectos");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Credenciales"
        subtitle="Gestión de credenciales cifradas"
        badge={{ value: "PRÓXIMAMENTE", label: "placeholder" }}
        actions={
          <button
            disabled
            title="Próximamente"
            className="rounded-lg bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary opacity-50 cursor-not-allowed"
          >
            Agregar credencial
          </button>
        }
      />

      <EmptyState
        icon="vpn_key"
        title="No hay credenciales configuradas"
        description="Las credenciales se almacenan cifradas y solo el superadmin puede gestionarlas."
        action={
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg bg-m3-primary px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-primary opacity-50 cursor-not-allowed"
          >
            Solicitar acceso
          </button>
        }
        onboarding={
          <p className="text-sm text-m3-on-surface-variant">
            Contacta al superadmin para configurar credenciales de proyectos.
          </p>
        }
      />
    </div>
  );
}
