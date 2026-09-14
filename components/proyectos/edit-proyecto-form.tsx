"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface EditProyectoFormProps {
  proyecto: ProyectoWithMetrics;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditProyectoForm({ proyecto, onSuccess, onCancel }: EditProyectoFormProps) {
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [ambiente, setAmbiente] = useState(proyecto.ambiente);
  const [versionSistema, setVersionSistema] = useState(proyecto.versionSistema ?? "");
  const [descripcion, setDescripcion] = useState(proyecto.descripcion ?? "");
  const [color, setColor] = useState(proyecto.color ?? "#C9822F");
  const [activo, setActivo] = useState(proyecto.activo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, ambiente, versionSistema, descripcion, color, activo }),
      });

      if (res.ok) {
        if (onSuccess) {
          onSuccess();
        }
      } else if (res.status === 400) {
        const data = await res.json();
        setError(data.message || "Datos inválidos");
      } else if (res.status === 403) {
        setError("No tienes permisos para editar proyectos");
      } else {
        setError("Error al actualizar el proyecto");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={() => onCancel?.()} labelledBy="edit-proyecto-title" className="max-w-md">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-proyecto-title" className="font-headline text-headline-md text-m3-on-surface">
            Editar proyecto
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cerrar"
              className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-nombre" className="font-label text-label-sm font-semibold text-m3-on-surface">
              Nombre del proyecto
            </label>
            <input
              id="edit-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
              className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-ambiente" className="font-label text-label-sm font-semibold text-m3-on-surface">
                Ambiente
              </label>
              <input
                id="edit-ambiente"
                type="text"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
                required
                maxLength={50}
                className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-version" className="font-label text-label-sm font-semibold text-m3-on-surface">
                Versión de sistema
              </label>
              <input
                id="edit-version"
                type="text"
                value={versionSistema}
                onChange={(e) => setVersionSistema(e.target.value)}
                maxLength={50}
                placeholder="Ej: v2.4.1"
                className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="edit-descripcion" className="font-label text-label-sm font-semibold text-m3-on-surface">
              Descripción
            </label>
            <textarea
              id="edit-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            />
          </div>

          <ColorPicker name="color" value={color} onChange={setColor} />

          <div className="flex items-center justify-between gap-4 rounded-lg border border-m3-outline-variant px-3.5 py-3">
            <div>
              <div className="font-label text-label-md font-semibold text-m3-on-surface">Proyecto activo</div>
              <p className="font-body text-body-sm text-m3-on-surface-variant">
                Los testers pueden ejecutar casos y ver resultados.
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} aria-label="Proyecto activo" />
          </div>

          {error && (
            <div className="rounded-lg bg-m3-danger-container p-3 font-body text-body-sm text-m3-error">
              {error}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="font-label text-label-md font-semibold text-m3-on-surface-variant hover:underline"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-m3-primary px-5 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
