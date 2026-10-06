import { redirect } from "next/navigation";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listUsuarios } from "@/lib/usuarios/actions";
import { UsuariosClient } from "./usuarios-client";
import { PageHeader } from "@/components/ui/page-header";
import { NuevoUsuarioTrigger } from "@/components/usuarios/nuevo-usuario-trigger";

export default async function UsuariosPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  // Un tester no gestiona personas.
  if (!usuario || usuario.rol === "tester") {
    redirect("/proyectos");
  }

  const usuarios = await listUsuarios(session);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        subtitle={
          usuario.rol === "superadmin"
            ? "Gestión de miembros y roles — crea administradores y testers"
            : "Gestión de miembros y roles — crea testers para asignarlos a los proyectos de tu espacio"
        }
        badge={{ value: usuarios.length, label: "usuarios" }}
        actions={<NuevoUsuarioTrigger />}
      />
      <UsuariosClient
        initialUsuarios={usuarios}
        puedeElegirRol={usuario.rol === "superadmin"}
        actorId={usuario.id}
        actorRol={usuario.rol}
      />
    </div>
  );
}
