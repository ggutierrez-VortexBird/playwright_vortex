import { redirect } from "next/navigation";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listUsuarios } from "@/lib/usuarios/actions";
import { UsuariosClient } from "./usuarios-client";

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
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Usuarios</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
          {usuario.rol === "superadmin"
            ? "Creá administradores y testers"
            : "Creá testers para asignarlos a los proyectos de tu espacio"}
        </span>
        <span className="ml-auto" />
      </div>
      <UsuariosClient initialUsuarios={usuarios} puedeElegirRol={usuario.rol === "superadmin"} />
    </div>
  );
}
