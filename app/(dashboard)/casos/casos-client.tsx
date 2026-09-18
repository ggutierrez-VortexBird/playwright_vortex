"use client";

import { useState, useCallback, useMemo } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { CasoTable } from "@/components/casos/caso-table";
import { EditCasoForm } from "@/components/casos/edit-caso-form";
import { ModeSelectorModal } from "@/components/casos/mode-selector-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionSearch } from "@/components/ui/section-search";
import { Button } from "@/components/ui/button";

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
  /** Cuando la vista está fijada a un único proyecto (e.g. /proyectos/[id]/casos). */
  proyectoContext?: { nombre: string; ambiente: string };
}

export function CasosClient({ casosIniciales, canEdit, proyectoId, proyectos, proyectoContext }: CasosClientProps) {
  const [casos, setCasos] = useState<CasoPruebaListItem[]>(casosIniciales);
  const [editingCaso, setEditingCaso] = useState<CasoPruebaListItem | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [deletingCaso, setDeletingCaso] = useState<CasoPruebaListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const casosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return casos;
    return casos.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)
    );
  }, [casos, busqueda]);

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
  }

  function handleDelete(caso: CasoPruebaListItem) {
    setDeletingCaso(caso);
  }

  async function confirmDelete() {
    if (!deletingCaso) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/casos/${deletingCaso.id}`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 204) {
        await refreshCasos();
      } else {
        alert("Error al eliminar el caso");
      }
    } catch {
      alert("Error de conexión al eliminar");
    } finally {
      setIsDeleting(false);
      setDeletingCaso(null);
    }
  }

  function handleEditSuccess() {
    setEditingCaso(null);
    refreshCasos();
  }

  function handleCancel() {
    setEditingCaso(null);
  }

  const proyectoNames = Array.from(new Set(casos.map((c) => c.proyectoNombre))).sort();
  const subtitle = proyectoContext
    ? `${proyectoContext.nombre} · ${proyectoContext.ambiente} · ${casos.length} caso${casos.length !== 1 ? "s" : ""}`
    : `${casos.length} caso${casos.length !== 1 ? "s" : ""} · ${proyectoNames.length} proyecto${proyectoNames.length !== 1 ? "s" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Casos de prueba"
        subtitle={subtitle}
        actions={
          canEdit ? (
            <Button
              variant="primary"
              onClick={() => setShowModeSelector(true)}
              data-testid="nuevo-caso-button"
              className="inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nuevo caso
            </Button>
          ) : undefined
        }
      />

      <div className="flex justify-end">
        <SectionSearch value={busqueda} onChange={setBusqueda} placeholder="Buscar caso…" />
      </div>

      {/* Mode selector modal (HU-G20): elegir modo + formulario embebido */}
      <ModeSelectorModal
        open={showModeSelector}
        onClose={() => setShowModeSelector(false)}
        proyectos={proyectos}
        onCasoCreated={refreshCasos}
        {...(proyectoId ? { proyectoId } : {})}
      />

      {/* Edit modal */}
      <Modal open={!!editingCaso} onClose={handleCancel} labelledBy="editar-caso-title" className="max-w-lg">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="editar-caso-title" className="font-headline text-headline-md text-m3-primary">
              Editar caso de prueba
            </h2>
            <Button variant="ghost" size="sm" onClick={handleCancel} aria-label="Cerrar">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Button>
          </div>
          {editingCaso && (
            <EditCasoForm
              key={editingCaso.id}
              caso={editingCaso}
              onSuccess={handleEditSuccess}
              onCancel={handleCancel}
            />
          )}
        </div>
      </Modal>

      {/* Casos grouped by proyecto, or flat when proyectoId is set */}
      {casos.length === 0 ? (
        <EmptyState
          icon="fact_check"
          title="No hay casos de prueba"
          description="Graba tu primer caso para comenzar a ejecutar pruebas automatizadas."
          action={
            canEdit ? (
              <Button
                variant="primary"
                onClick={() => setShowModeSelector(true)}
                data-testid="nuevo-caso-button"
                className="inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Nuevo caso
              </Button>
            ) : undefined
          }
        />
      ) : casosFiltrados.length === 0 ? (
        <EmptyState icon="search_off" title={`Sin resultados para "${busqueda}"`} />
      ) : (
        <CasoTable
          casos={casosFiltrados}
          canEdit={canEdit}
          onEdit={canEdit ? handleEdit : undefined}
          onDelete={canEdit ? handleDelete : undefined}
        />
      )}

      <ConfirmDialog
        open={!!deletingCaso}
        title="¿Eliminar este caso de prueba?"
        description="Esta acción no se puede deshacer. Se eliminarán también sus ejecuciones y actas asociadas."
        itemLabel={deletingCaso ? `${deletingCaso.codigo} · ${deletingCaso.nombre}` : undefined}
        confirmLabel="Eliminar caso"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingCaso(null)}
      />
    </div>
  );
}
