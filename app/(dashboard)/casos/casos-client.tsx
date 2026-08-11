"use client";

import { useState, useCallback } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { CasoTable } from "@/components/casos/caso-table";
import { CreateCasoForm } from "@/components/casos/create-caso-form";
import { EditCasoForm } from "@/components/casos/edit-caso-form";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

interface CasosClientProps {
  casosIniciales: CasoPruebaListItem[];
  canEdit: boolean;
  proyectoId?: string;
  proyectos?: ProyectoOption[];
}

export function CasosClient({ casosIniciales, canEdit, proyectoId, proyectos }: CasosClientProps) {
  const [casos, setCasos] = useState<CasoPruebaListItem[]>(casosIniciales);
  const [editingCaso, setEditingCaso] = useState<CasoPruebaListItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refreshCasos = useCallback(async () => {
    try {
      const res = await fetch("/api/casos");
      if (res.ok) {
        const data = await res.json();
        setCasos(data.casos || []);
      }
    } catch {
      // Ignore refresh errors
    }
  }, []);

  function handleEdit(caso: CasoPruebaListItem) {
    setEditingCaso(caso);
    setShowForm(false);
  }

  async function handleDelete(caso: CasoPruebaListItem) {
    if (!confirm(`¿Eliminar el caso "${caso.nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/casos/${caso.id}`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 204) {
        await refreshCasos();
      } else {
        alert("Error al eliminar el caso");
      }
    } catch {
      alert("Error de conexión al eliminar");
    }
  }

  function handleCreateSuccess() {
    setShowForm(false);
    refreshCasos();
  }

  function handleEditSuccess() {
    setEditingCaso(null);
    refreshCasos();
  }

  function handleCancel() {
    setShowForm(false);
    setEditingCaso(null);
  }

  // Group casos by proyecto
  const casosByProyecto = new Map<string, CasoPruebaListItem[]>();
  for (const caso of casos) {
    const list = casosByProyecto.get(caso.proyectoNombre) || [];
    list.push(caso);
    casosByProyecto.set(caso.proyectoNombre, list);
  }

  const proyectoNames = Array.from(casosByProyecto.keys()).sort();

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Casos de prueba</h1>
          <p className="mt-1 text-ink-3">Todos los casos de prueba activos</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingCaso(null);
            }}
            className="rounded-md bg-client px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-client/90"
          >
            + Nuevo Caso
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <CreateCasoForm
          proyectoId={proyectoId}
          proyectos={proyectos}
          onSuccess={handleCreateSuccess}
          onCancel={handleCancel}
        />
      )}

      {/* Edit form */}
      {editingCaso && (
        <EditCasoForm
          caso={editingCaso}
          onSuccess={handleEditSuccess}
          onCancel={handleCancel}
        />
      )}

      {/* Casos grouped by proyecto, or flat when proyectoId is set */}
      {casos.length === 0 ? (
        <div className="rounded-lg border border-rule bg-surface p-8 text-center">
          <p className="text-ink-3">No hay casos de prueba registrados.</p>
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm text-client hover:underline"
            >
              Crear el primer caso
            </button>
          )}
        </div>
      ) : proyectoId ? (
        <CasoTable
          casos={casos}
          canEdit={canEdit}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canEdit ? handleDelete : undefined}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {proyectoNames.map((proyectoNombre) => {
            const proyectoCasos = casosByProyecto.get(proyectoNombre) || [];
            return (
              <div key={proyectoNombre} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink">{proyectoNombre}</h2>
                  <span className="text-sm text-ink-3">
                    ({proyectoCasos.length} caso{proyectoCasos.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <CasoTable
                  casos={proyectoCasos}
                  canEdit={canEdit}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canEdit ? handleDelete : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
