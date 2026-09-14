"use client";

import { useState, useCallback } from "react";
import type { ProyectoWithMetrics } from "@/types/proyecto";
import type { Espacio } from "@/types/espacio";
import { ProyectoCard } from "@/components/proyectos/proyecto-card";
import { CreateProyectoForm } from "@/components/proyectos/create-proyecto-form";
import { EditProyectoForm } from "@/components/proyectos/edit-proyecto-form";
import { TestersDialog } from "@/components/proyectos/testers-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [deletingProyecto, setDeletingProyecto] = useState<ProyectoWithMetrics | null>(null);
  const [manageTestersFor, setManageTestersFor] = useState<ProyectoWithMetrics | null>(null);

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

  function handleDelete(proyecto: ProyectoWithMetrics) {
    setDeletingProyecto(proyecto);
  }

  async function confirmDelete() {
    if (!deletingProyecto) return;
    setDeletingId(deletingProyecto.id);
    try {
      const res = await fetch(`/api/proyectos/${deletingProyecto.id}`, {
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
      setDeletingProyecto(null);
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
  // Un tester puede tener proyectos asignados de espacios a los que no tiene
  // acceso directo (no le corresponde ver Espacios) — por eso la agrupación
  // se arma a partir de los proyectos visibles, no de la lista de espacios.
  const espacioIdsConProyectos = Array.from(proyectosByEspacio.keys());
  const espacioCount = espacios.length > 0 ? espacios.length : espacioIdsConProyectos.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado de página */}
      <div className="flex flex-col gap-4 border-b border-m3-outline-variant pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-headline text-headline-lg text-m3-primary">Proyectos</h2>
            <span className="rounded-full border border-m3-outline-variant bg-m3-surface-container px-3 py-0.5 font-body text-body-sm font-medium text-m3-on-surface-variant">
              {proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""} · {espacioCount} espacio
              {espacioCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
            Supervisa y ejecuta las suites de automatización organizadas por espacios de trabajo
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProyecto(null);
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 font-label text-label-sm font-semibold text-m3-on-primary shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Proyecto
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
      {proyectos.length === 0 ? (
        <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
          <p className="text-m3-on-surface-variant">
            {espacios.length === 0 ? "No hay espacios creados aún." : "No hay proyectos asignados a tu cuenta."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {espacioIdsConProyectos.map((espacioId) => {
            const espacioProyectos = proyectosByEspacio.get(espacioId) || [];
            const espacio = espacioMap.get(espacioId);
            const nombre = espacio?.nombre ?? "Proyecto asignado";
            const color = espacio?.color ?? "#9CA3AF";
            return (
              <div key={espacioId} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-md shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <h2 className="flex items-baseline gap-2 font-headline text-headline-md font-bold tracking-tight text-m3-on-surface">
                    {nombre}
                    <span className="font-body text-label-sm font-medium text-m3-on-surface-variant">
                      ({espacioProyectos.length} proyecto{espacioProyectos.length !== 1 ? "s" : ""})
                    </span>
                  </h2>
                </div>
                <div className="proj-grid">
                  {espacioProyectos.map((proyecto) => (
                    <ProyectoCard
                      key={proyecto.id}
                      proyecto={proyecto}
                      espacioNombre={nombre}
                      espacioColor={color}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onManageTesters={setManageTestersFor}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {manageTestersFor && (
        <TestersDialog
          proyectoId={manageTestersFor.id}
          proyectoNombre={manageTestersFor.nombre}
          onClose={() => setManageTestersFor(null)}
        />
      )}

      <ConfirmDialog
        open={!!deletingProyecto}
        title="¿Eliminar este proyecto?"
        description="Esta acción no se puede deshacer. Se eliminarán también sus casos de prueba, ejecuciones y actas asociadas."
        itemLabel={
          deletingProyecto
            ? `${deletingProyecto.nombre} · ${espacioMap.get(deletingProyecto.espacioId)?.nombre ?? ""}`
            : undefined
        }
        itemColor={deletingProyecto ? espacioMap.get(deletingProyecto.espacioId)?.color : undefined}
        confirmLabel="Eliminar proyecto"
        isLoading={!!deletingId}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingProyecto(null)}
      />
    </div>
  );
}
