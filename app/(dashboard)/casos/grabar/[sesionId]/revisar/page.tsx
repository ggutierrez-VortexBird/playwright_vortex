/**
 * /casos/grabar/[sesionId]/revisar — placeholder para la pantalla de revisión.
 *
 * Server Component:
 *   1. Auth: requiere sesión; redirige a /login si no.
 *   2. Carga la SesionGrabacion (conteo de pasos incluidos) desde DB.
 *   3. Verifica ownership → redirige a /casos si no es del usuario.
 *   4. Renderiza el componente cliente RevisarPlaceholder.
 *
 * Esta página existe porque el botón "Detener y revisar" del topbar ya
 * redirige acá (HU-G2). La pantalla completa de revisión llega en HU-G8
 * (que mostrará video, pasos navegables, edición, etc.) — por ahora
 * mostramos un card con icono + "Volver" button para cerrar el flow.
 *
 * Response:
 *   - 200 + RevisarPlaceholder para sesiones existentes y owned
 *   - redirect /login si no hay sesión
 *   - redirect /casos si la sesión es de otro usuario
 *   - 404 si la sesión no existe
 */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { RevisarPlaceholder } from "@/components/grabador/revisar-placeholder";

interface PageProps {
  params: Promise<{ sesionId: string }>;
}

export default async function RevisarSesionPage({ params }: PageProps) {
  const { sesionId } = await params;
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id: sesionId },
    select: {
      id: true,
      usuarioId: true,
      _count: {
        select: { pasos: true },
      },
    },
  });

  if (!sesion) {
    notFound();
  }

  if (sesion.usuarioId !== session.userId) {
    redirect("/casos");
  }

  return (
    <RevisarPlaceholder
      sesionId={sesion.id}
      pasosCount={sesion._count.pasos}
    />
  );
}
