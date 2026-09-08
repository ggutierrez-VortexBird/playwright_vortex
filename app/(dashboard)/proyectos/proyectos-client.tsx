"use client";

import { useState, useCallback } from "react";
import type { ProyectoWithMetrics } from "@/types/proyecto";
import type { Espacio } from "@/types/espacio";
import { ProyectoCard } from "@/components/proyectos/proyecto-card";
import { CreateProyectoForm } from "@/components/proyectos/create-proyecto-form";
import { EditProyectoForm } from "@/components/proyectos/edit-proyecto-form";

interface ProyectosClientProps {
  espacios: Espacio[];
  proyectosIniciales: ProyectoWithMetrics[];
  canEdit: boolean;
}

export function ProyectosClient({ espacios, proyectosIniciales, canEdit }: ProyectosClientProps) {
  const [proyectos, setProyectos] = useState<ProyectoWithMetrics[]>(proyectosIniciales);
  const [editingProyecto, setEditingProyecto] = useState<ProyectoWithMetrics | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshProyectos = useCallback(async () => {
    const allProyectos: ProyectoWithMetrics[] = [];
    await Promise.all(
      espacios.map(async (espacio) => {
        try {
          const res = await fetch(`/api/proyectos?espacioId=${espacio.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.proyectos) {
              allProyectos.push(...data.proyectos);
            }
          }
        } catch {
          // Ignore fetch errors for individual espacios
        }
      })
    );
    setProyectos(allProyectos);
  }, [espacios]);

  function handleEdit(proyecto: ProyectoWithMetrics) {
    setEditingProyecto(proyecto);
    setShowForm(false);
  }

  async function handleDelete(proyecto: ProyectoWithMetrics) {
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}"?`)) {
      return;
    }
    setDeletingId(proyecto.id);
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        await refreshProyectos();
      } else {
        alert("Error al eliminar el proyecto");
      }
    } catch {
      alert("Error de conexión al eliminar");
    } finally {
      setDeletingId(null);
    }
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

  // Group proyectos by espacio
  const proyectosByEspacio = new Map<string, ProyectoWithMetrics[]>();
  for (const proyecto of proyectos) {
    const list = proyectosByEspacio.get(proyecto.espacioId) || [];
    list.push(proyecto);
    proyectosByEspacio.set(proyecto.espacioId, list);
  }

  const espacioMap = new Map(espacios.map((e) => [e.id, e]));

  return (
    <div className="flex flex-col gap-6">
      {/* Topbar — mockup style */}
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Proyectos</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
          {proyectos.length} proyectos · {espacios.length} espacios
        </span>
        <span className="ml-auto" />
        {canEdit && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProyecto(null);
            }}
            className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 transition-opacity"
          >
            + Nuevo Proyecto
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <CreateProyectoForm
          espacios={espacios.map((e) => ({ id: e.id, nombre: e.nombre, color: e.color }))}
          onSuccess={handleCreateSuccess}
          onCancel={handleCancel}
        />
      )}

      {/* Edit form */}
      {editingProyecto && (
        <EditProyectoForm
          proyecto={editingProyecto}
          onSuccess={handleEditSuccess}
          onCancel={handleCancel}
        />
      )}

      {/* Proyectos grouped by espacio */}
      {espacios.length === 0 ? (
        <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
          <p className="text-m3-on-surface-variant">No hay espacios creados aún.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {espacios.map((espacio) => {
            const espacioProyectos = proyectosByEspacio.get(espacio.id) || [];
            if (espacioProyectos.length === 0) {
              return null;
            }
            return (
              <div key={espacio.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: espacio.color }}
                  />
                  <h2 className="font-headline text-headline-md text-m3-primary">{espacio.nombre}</h2>
                  <span className="font-body text-body-sm text-m3-on-surface-variant">
                    ({espacioProyectos.length} proyecto{espacioProyectos.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="proj-grid">
                  {espacioProyectos.map((proyecto) => (
                    <ProyectoCard
                      key={proyecto.id}
                      proyecto={proyecto}
                      espacioNombre={espacio.nombre}
                      espacioColor={espacio.color}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
