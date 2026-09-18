"use client";

import { useState, useCallback } from "react";
import type { ProyectoWithMetrics } from "@/types/proyecto";
import type { Espacio } from "@/types/espacio";
import { ProyectoCard, codigoProyecto } from "@/components/proyectos/proyecto-card";
import { CreateProyectoForm } from "@/components/proyectos/create-proyecto-form";
import { EditProyectoForm } from "@/components/proyectos/edit-proyecto-form";
import { TestersDialog } from "@/components/proyectos/testers-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { SectionSearch } from "@/components/ui/section-search";
import { Button } from "@/components/ui/button";

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
  const [busqueda, setBusqueda] = useState("");

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

  // Group proyectos by espacio (ya filtrados por la búsqueda local) — busca
  // por nombre, ambiente, descripción o código (#PRY-XXXX), no solo nombre.
  const q = busqueda.trim().toLowerCase();
  const proyectosFiltrados = q
    ? proyectos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.ambiente.toLowerCase().includes(q) ||
          (p.descripcion ?? "").toLowerCase().includes(q) ||
          codigoProyecto(p.id).toLowerCase().includes(q)
      )
    : proyectos;

  const proyectosByEspacio = new Map<string, ProyectoWithMetrics[]>();
  for (const proyecto of proyectosFiltrados) {
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
      <PageHeader
        title="Proyectos"
        badge={{ value: proyectos.length, label: proyectos.length === 1 ? "proyecto" : "proyectos" }}
        subtitle={`${proyectos.length} proyecto${proyectos.length !== 1 ? "s" : ""} · ${espacioCount} espacio${espacioCount !== 1 ? "s" : ""}`}
        description="Supervisa y ejecuta las suites de automatización organizadas por espacios de trabajo"
        actions={
          canEdit ? (
            <Button
              variant="primary"
              onClick={() => {
                setShowForm(true);
                setEditingProyecto(null);
              }}
              className="inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nuevo Proyecto
            </Button>
          ) : undefined
        }
      />

      <div className="flex justify-end">
        <SectionSearch value={busqueda} onChange={setBusqueda} placeholder="Buscar proyecto…" />
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
