import { redirect } from "next/navigation";
import { getSession, getUsuarioActual, ROL_LABEL } from "@/lib/auth";
import { PerfilClient } from "./perfil-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function PerfilPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mi perfil"
        subtitle={`${ROL_LABEL[usuario.rol]} · ${usuario.email}`}
      />
      <PerfilClient nombreActual={usuario.nombre} email={usuario.email} />
    </div>
  );
}
