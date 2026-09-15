"use client";

import { useState, useCallback } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { CasoTable } from "@/components/casos/caso-table";
import { EditCasoForm } from "@/components/casos/edit-caso-form";
import { ModeSelectorModal } from "@/components/casos/mode-selector-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [deletingCaso, setDeletingCaso] = useState<CasoPruebaListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="-mx-4 -mt-4 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4">
        <div>
          <h2 className="font-headline text-headline-lg text-m3-primary">Casos de prueba</h2>
          <span className="font-body text-body-sm text-m3-on-surface-variant">
            {casos.length} caso{casos.length !== 1 ? "s" : ""} · {proyectoNames.length} proyecto{proyectoNames.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="ml-auto" />
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModeSelector(true)}
            data-testid="nuevo-caso-button"
            className="flex items-center gap-1.5 rounded bg-m3-primary px-4 py-2 font-label text-label-lg font-semibold text-m3-on-primary hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Nuevo caso
          </button>
        )}
      </div>

      {/* Mode selector modal (HU-G20): elegir modo + formulario embebido */}
      <ModeSelectorModal
        open={showModeSelector}
        onClose={() => setShowModeSelector(false)}
        proyectos={proyectos}
        onCasoCreated={refreshCasos}
        {...(proyectoId ? { proyectoId } : {})}
      />

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
        <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
          <p className="font-body text-body-md text-m3-on-surface-variant">
            No hay casos de prueba registrados.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowModeSelector(true)}
              className="mt-2 font-label text-label-md text-m3-secondary hover:underline"
            >
              Crear el primer caso
            </button>
          )}
        </div>
      ) : (
        <CasoTable
          casos={casos}
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
