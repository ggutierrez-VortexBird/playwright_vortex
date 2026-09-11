"use client";

import { useEffect, useRef, useState } from "react";

interface UsuarioOption {
  id: string;
  email: string;
  rol: string;
}

interface TesterAsignado {
  id: string;
  email: string;
  asignadoDesde: string;
}

interface TestersDialogProps {
  proyectoId: string;
  proyectoNombre: string;
  onClose: () => void;
}

export function TestersDialog({ proyectoId, proyectoNombre, onClose }: TestersDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [asignados, setAsignados] = useState<TesterAsignado[]>([]);
  const [candidatos, setCandidatos] = useState<UsuarioOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [resTesters, resUsuarios] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/testers`),
        fetch(`/api/usuarios`),
      ]);
      if (!resTesters.ok) throw new Error("No se pudo cargar los testers asignados");
      const dataTesters = await resTesters.json();
      setAsignados(dataTesters.testers ?? []);

      if (resUsuarios.ok) {
        const dataUsuarios = await resUsuarios.json();
        const usuarios: UsuarioOption[] = dataUsuarios.usuarios ?? [];
        setCandidatos(usuarios.filter((u) => u.rol === "tester"));
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
  }, [proyectoId]);

  async function handleAsignar() {
    if (!selected) return;
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/testers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo asignar el tester");
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
      const res = await fetch(`/api/proyectos/${proyectoId}/testers?usuarioId=${usuarioId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No se pudo quitar el tester");
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
      className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="w-96 max-w-full p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-headline-md text-m3-primary">Testers del proyecto</h3>
          <button
            onClick={handleClose}
            className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 font-body text-body-sm text-m3-on-surface-variant">{proyectoNombre}</p>

        {error && (
          <div className="mb-3 rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-body text-body-sm text-m3-on-surface-variant">Cargando…</p>
        ) : (
          <>
            <ul className="mb-4 flex flex-col gap-2">
              {asignados.length === 0 && (
                <li className="font-body text-body-sm text-m3-on-surface-variant">
                  Ningún tester asignado todavía.
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
                <option value="">Selecciona un tester…</option>
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
                No hay testers disponibles para asignar. Creá uno en la sección Usuarios.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
