"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

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
    onClose();
  }

  const asignadosIds = new Set(asignados.map((a) => a.id));
  const disponibles = candidatos.filter((c) => !asignadosIds.has(c.id));

  return (
    <Modal open onClose={handleClose} labelledBy="testers-dialog-title" className="max-w-md">
      <div className="p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 id="testers-dialog-title" className="font-headline text-headline-md text-m3-on-surface">Testers del proyecto</h3>
          <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Cerrar">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </Button>
        </div>
        <p className="mb-4 font-body text-body-sm text-m3-on-surface-variant">{proyectoNombre}</p>

        {error && (
          <div className="mb-3 rounded-lg bg-m3-danger-container px-3 py-2 font-body text-body-sm text-m3-error">
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
                  className="flex items-center gap-3 rounded-lg bg-m3-surface-container px-3 py-2.5"
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-m3-primary-container font-label text-label-sm font-bold text-white">
                    {a.email.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-body text-body-sm font-medium text-m3-on-surface">{a.email}</div>
                    <div className="font-body text-body-sm text-m3-on-surface-variant">Tester</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-m3-error"
                    onClick={() => handleQuitar(a.id)}
                    aria-label={`Quitar ${a.email}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </Button>
                </li>
              ))}
            </ul>

            <label className="mb-1 block font-label text-label-sm font-semibold text-m3-on-surface">
              Agregar tester existente
            </label>
            <div className="flex gap-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="flex-1 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-sm text-m3-on-surface"
              >
                <option value="">Selecciona un tester…</option>
                {disponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={handleAsignar} disabled={!selected}>
                Asignar
              </Button>
            </div>
            {disponibles.length === 0 && (
              <p className="mt-2 font-body text-body-sm text-m3-on-surface-variant">
                No hay testers disponibles para asignar. Crea uno en la sección Usuarios.
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
