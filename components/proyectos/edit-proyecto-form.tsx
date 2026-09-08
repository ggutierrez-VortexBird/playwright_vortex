"use client";

import { useState } from "react";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface EditProyectoFormProps {
  proyecto: ProyectoWithMetrics;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditProyectoForm({ proyecto, onSuccess, onCancel }: EditProyectoFormProps) {
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [ambiente, setAmbiente] = useState(proyecto.ambiente);
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
        body: JSON.stringify({ nombre, ambiente }),
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
    <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-6">
      <h2 className="mb-4 font-headline text-headline-md text-m3-primary">Editar Proyecto</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="edit-nombre" className="block text-sm font-medium text-m3-on-surface">
            Nombre del proyecto
          </label>
          <input
            id="edit-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: Tests QA Bancoomeva"
          />
        </div>

        <div>
          <label htmlFor="edit-ambiente" className="block text-sm font-medium text-m3-on-surface">
            Ambiente
          </label>
          <input
            id="edit-ambiente"
            type="text"
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            required
            maxLength={50}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: QA, PROD, DEV"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-m3-error">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-m3-outline-variant px-4 py-2 text-sm font-medium text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
