"use client";

import { useEffect, useRef, useState } from "react";

interface UsuarioOption {
  id: string;
  email: string;
  rol: string;
}

interface AdminAsignado {
  id: string;
  email: string;
  asignadoDesde: string;
}

interface AdminsDialogProps {
  espacioId: string;
  espacioNombre: string;
  onClose: () => void;
  /** Se dispara con la lista final de admins cada vez que cambia (asignar/quitar),
   *  para que el padre pueda reflejarlo en la card sin esperar a un recargar. */
  onChanged?: (admins: AdminAsignado[]) => void;
}

export function AdminsDialog({ espacioId, espacioNombre, onClose, onChanged }: AdminsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [asignados, setAsignados] = useState<AdminAsignado[]>([]);
  const [candidatos, setCandidatos] = useState<UsuarioOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [resAdmins, resUsuarios] = await Promise.all([
        fetch(`/api/espacios/${espacioId}/admins`),
        fetch(`/api/usuarios`),
      ]);
      if (!resAdmins.ok) throw new Error("No se pudo cargar los admins asignados");
      const dataAdmins = await resAdmins.json();
      const admins: AdminAsignado[] = dataAdmins.admins ?? [];
      setAsignados(admins);
      onChanged?.(admins);

      if (resUsuarios.ok) {
        const dataUsuarios = await resUsuarios.json();
        const usuarios: UsuarioOption[] = dataUsuarios.usuarios ?? [];
        setCandidatos(usuarios.filter((u) => u.rol === "admin"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    dialogRef.current?.showModal();
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacioId]);

  async function handleAsignar() {
    if (!selected) return;
    setError(null);
    try {
      const res = await fetch(`/api/espacios/${espacioId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo asignar el admin");
      }
      setSelected("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar");
    }
  }

  async function handleQuitar(usuarioId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/espacios/${espacioId}/admins?usuarioId=${usuarioId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No se pudo quitar el admin");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al quitar");
    }
  }

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  const asignadosIds = new Set(asignados.map((a) => a.id));
  const disponibles = candidatos.filter((c) => !asignadosIds.has(c.id));

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      onClose={onClose}
      className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85vh] w-96 max-w-full overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-headline-md text-m3-primary">Administradores del espacio</h3>
          <button
            onClick={handleClose}
            className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 font-body text-body-sm text-m3-on-surface-variant">{espacioNombre}</p>

        {error && (
          <div className="mb-3 rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-body text-body-sm text-m3-on-surface-variant">Cargando…</p>
        ) : (
          <>
            <ul className="scroll-hidden mb-4 flex max-h-56 flex-col gap-2 overflow-y-auto">
              {asignados.length === 0 && (
                <li className="font-body text-body-sm text-m3-on-surface-variant">
                  Ningún admin asignado todavía.
                </li>
              )}
              {asignados.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-m3-outline-variant px-3 py-2"
                >
                  <span className="font-body text-body-sm text-m3-on-surface">{a.email}</span>
                  <button
                    onClick={() => handleQuitar(a.id)}
                    className="font-label text-label-sm text-m3-error hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="flex-1 rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-sm text-m3-on-surface"
              >
                <option value="">Selecciona un admin…</option>
                {disponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAsignar}
                disabled={!selected}
                className="rounded bg-m3-primary px-3 py-2 font-label text-label-sm font-semibold text-m3-on-primary hover:opacity-90 disabled:opacity-40"
              >
                Asignar
              </button>
            </div>
            {disponibles.length === 0 && (
              <p className="mt-2 font-body text-body-sm text-m3-on-surface-variant">
                No hay usuarios con rol admin disponibles. Crea uno en la sección Usuarios.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
