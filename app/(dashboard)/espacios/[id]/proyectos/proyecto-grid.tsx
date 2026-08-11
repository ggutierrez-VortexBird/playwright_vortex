"use client";

import { useState, useEffect } from "react";
import { ProyectoCard } from "@/components/proyectos/proyecto-card";
import { CreateProyectoForm } from "@/components/proyectos/create-proyecto-form";
import { EditProyectoForm } from "@/components/proyectos/edit-proyecto-form";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface ProyectoGridProps {
  espacioId: string;
  espacioNombre: string;
  espacioColor: string | null;
  canEdit: boolean;
}

export function ProyectoGrid({ espacioId, espacioNombre, espacioColor, canEdit }: ProyectoGridProps) {
  const [proyectos, setProyectos] = useState<ProyectoWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<ProyectoWithMetrics | null>(null);

  useEffect(() => {
    async function fetchProyectos() {
      try {
        const res = await fetch(`/api/proyectos/?espacioId=${espacioId}`);
        if (!res.ok) throw new Error("Failed to fetch proyectos");
        const data = await res.json();
        setProyectos(data.proyectos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchProyectos();
  }, [espacioId]);

  async function handleDelete(proyecto: ProyectoWithMetrics) {
    if (!confirm(`¿Estás seguro de eliminar "${proyecto.nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setProyectos((prev) => prev.filter((p) => p.id !== proyecto.id));
      } else if (res.status === 409) {
        alert("No se puede eliminar: hay proyectos activos");
      }
    } catch (err) {
      console.error("Error deleting proyecto:", err);
    }
  }

  function handleEdit(proyecto: ProyectoWithMetrics) {
    setEditingProyecto(proyecto);
    setShowForm(false);
  }

  function handleCreateSuccess() {
    setShowForm(false);
    refreshProyectos();
  }

  function handleEditSuccess() {
    setEditingProyecto(null);
    refreshProyectos();
  }

  function handleCancel() {
    setShowForm(false);
    setEditingProyecto(null);
  }

  function refreshProyectos() {
    setLoading(true);
    fetch(`/api/proyectos/?espacioId=${espacioId}`)
      .then((res) => res.json())
      .then((data) => {
        setProyectos(data.proyectos || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {canEdit && (
          <div className="rounded-lg border border-rule bg-surface p-6">
            <div className="h-8 w-32 animate-pulse rounded bg-rule-soft" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-rule bg-surface p-4"
            >
              <div className="h-4 w-20 rounded bg-rule-soft" />
              <div className="mt-2 h-6 w-32 rounded bg-rule-soft" />
              <div className="mt-1 h-4 w-16 rounded bg-rule-soft" />
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-rule pt-4">
                <div className="h-8 rounded bg-rule-soft" />
                <div className="h-8 rounded bg-rule-soft" />
                <div className="h-8 rounded bg-rule-soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-stamp bg-red-50 p-4 text-stamp">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botón y formularios de creación/edición */}
      {canEdit && (
        <div>
          {!showForm && !editingProyecto && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-client px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-client/90"
            >
              + Nuevo Proyecto
            </button>
          )}

          {showForm && (
            <CreateProyectoForm
              espacioId={espacioId}
              onSuccess={handleCreateSuccess}
              onCancel={handleCancel}
            />
          )}

          {editingProyecto && (
            <EditProyectoForm
              proyecto={editingProyecto}
              onSuccess={handleEditSuccess}
              onCancel={handleCancel}
            />
          )}
        </div>
      )}

      {/* Grid de proyectos */}
      {proyectos.length === 0 && !showForm ? (
        <div className="rounded-lg border border-rule bg-surface p-8 text-center">
          <p className="text-ink-3">No hay proyectos en este espacio.</p>
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-client hover:underline"
            >
              Crear el primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((proyecto) => (
            <ProyectoCard
              key={proyecto.id}
              proyecto={proyecto}
              espacioNombre={espacioNombre}
              espacioColor={espacioColor}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canEdit ? handleDelete : undefined}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
