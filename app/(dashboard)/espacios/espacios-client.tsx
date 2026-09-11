"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { EspaciosForm } from "./espacios-form";
import { AdminsDialog } from "@/components/espacios/admins-dialog";
import type { Espacio } from "@/types/espacio";

interface EspacioCardProps {
  espacio: Espacio;
  proyectoCount: number;
  canEdit: boolean;
  onEnter: (espacioId: string) => void;
  onManageAdmins: (espacio: Espacio) => void;
  onEdit: (espacio: Espacio) => void;
  onDelete: (espacio: Espacio) => void;
}

function EspacioCard({
  espacio,
  proyectoCount,
  canEdit,
  onEnter,
  onManageAdmins,
  onEdit,
  onDelete,
}: EspacioCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      <div className="h-[5px]" style={{ backgroundColor: espacio.color }} />

      {canEdit && (
        <div className="absolute right-3 top-4 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onManageAdmins(espacio)}
            className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary"
            title="Administradores del espacio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(espacio)}
            className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary"
            title="Editar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(espacio)}
            className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-danger-container hover:text-m3-error"
            title="Eliminar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="truncate font-body text-body-lg font-bold text-m3-on-surface">
          {espacio.nombre}
        </div>
        <div className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          {proyectoCount} proyecto{proyectoCount !== 1 ? "s" : ""}
        </div>
        <button
          onClick={() => onEnter(espacio.id)}
          className="mt-5 w-full rounded-lg border border-m3-outline-variant py-2 text-center font-label text-label-md font-semibold text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
        >
          Entrar →
        </button>
      </div>
    </div>
  );
}

interface EspaciosListProps {
  espacios: Espacio[];
  proyectoCounts: Record<string, number>;
  onEdit: (espacio: Espacio) => void;
  onDelete: (espacio: Espacio) => void;
  onCreate: () => void;
  canEdit: boolean;
}

function EspaciosList({ espacios, proyectoCounts, onEdit, onDelete, onCreate, canEdit }: EspaciosListProps) {
  const router = useRouter();
  const [manageAdminsFor, setManageAdminsFor] = useState<Espacio | null>(null);

  function handleViewProyectos(espacioId: string) {
    router.push(`/espacios/${espacioId}/proyectos`);
  }

  if (espacios.length === 0 && !canEdit) {
    return (
      <div className="rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center shadow-card">
        <p className="font-body text-body-md text-m3-on-surface-variant">
          No hay espacios asignados a tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {espacios.map((espacio) => (
        <EspacioCard
          key={espacio.id}
          espacio={espacio}
          proyectoCount={proyectoCounts[espacio.id] ?? 0}
          canEdit={canEdit}
          onEnter={handleViewProyectos}
          onManageAdmins={setManageAdminsFor}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      {canEdit && (
        <button
          onClick={onCreate}
          className="flex min-h-[168px] flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-m3-outline-variant text-m3-on-surface-variant transition-colors hover:border-m3-outline hover:bg-m3-surface-container-high hover:text-m3-on-surface"
        >
          <span className="text-2xl leading-none">＋</span>
          <span className="font-label text-label-md font-semibold">Crear espacio</span>
        </button>
      )}
      {manageAdminsFor && (
        <AdminsDialog
          espacioId={manageAdminsFor.id}
          espacioNombre={manageAdminsFor.nombre}
          onClose={() => setManageAdminsFor(null)}
        />
      )}
    </div>
  );
}

interface EspaciosClientProps {
  initialEspacios: Espacio[];
  proyectoCounts: Record<string, number>;
  canEdit: boolean;
}

export function EspaciosClient({ initialEspacios, proyectoCounts, canEdit }: EspaciosClientProps) {
  const [espacios, setEspacios] = useState<Espacio[]>(initialEspacios);
  const [editingEspacio, setEditingEspacio] = useState<Espacio | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openCreateModal() {
    setShowCreateForm(true);
    dialogRef.current?.showModal();
  }

  function openEditModal(espacio: Espacio) {
    setEditingEspacio(espacio);
    setShowCreateForm(false);
    dialogRef.current?.showModal();
  }

  function closeModal() {
    setEditingEspacio(null);
    setShowCreateForm(false);
    dialogRef.current?.close();
  }

  async function handleDelete(espacio: Espacio) {
    if (!confirm(`¿Estás seguro de eliminar "${espacio.nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/espacios/${espacio.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setEspacios((prev) => prev.filter((e) => e.id !== espacio.id));
      }
    } catch (err) {
      console.error("Error deleting espacio:", err);
    }
  }

  function handleEdit(espacio: Espacio) {
    openEditModal(espacio);
  }

  const handleSuccess = useCallback((updated: Espacio, isEdit: boolean) => {
    if (isEdit) {
      setEspacios((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSuccessMessage(`"${updated.nombre}" actualizado exitosamente`);
    } else {
      setEspacios((prev) => [updated, ...prev]);
      setSuccessMessage(`"${updated.nombre}" creado exitosamente`);
    }
    closeModal();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      closeModal();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Success notification */}
      {successMessage && (
        <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-right-2 fade-in duration-300">
          <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        </div>
      )}

      {/* Modal */}
      {canEdit && (
        <dialog
          ref={dialogRef}
          onClick={handleDialogClick}
          className="rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50"
        >
          <div className="max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-m3-primary">
                {editingEspacio ? "Editar espacio" : "Nuevo espacio"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <EspaciosForm
              key={editingEspacio?.id ?? "create"}
              espacio={editingEspacio ?? undefined}
              onSuccess={handleSuccess}
              onCancel={closeModal}
            />
          </div>
        </dialog>
      )}

      <EspaciosList
        espacios={espacios}
        proyectoCounts={proyectoCounts}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={openCreateModal}
        canEdit={canEdit}
      />
    </div>
  );
}
