"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { EspaciosForm } from "./espacios-form";
import type { Espacio } from "@/types/espacio";

interface EspaciosListProps {
  espacios: Espacio[];
  onEdit: (espacio: Espacio) => void;
  onDelete: (espacio: Espacio) => void;
}

function EspaciosList({ espacios, onEdit, onDelete }: EspaciosListProps) {
  const router = useRouter();

  function handleViewProyectos(espacioId: string) {
    router.push(`/espacios/${espacioId}/proyectos`);
  }

  if (espacios.length === 0) {
    return (
      <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
        <p className="font-body text-body-md text-m3-on-surface-variant">
          No hay espacios creados aún.
        </p>
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          Usa el formulario de arriba para crear el primero.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {espacios.map((espacio) => (
        <div
          key={espacio.id}
          className="group relative flex flex-col rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-4 transition-colors hover:border-m3-outline"
          style={{ borderLeftWidth: "4px", borderLeftColor: espacio.color }}
        >
          <span className="truncate font-body text-body-md font-medium text-m3-on-surface">
            {espacio.nombre}
          </span>
          <div className="mt-3 flex items-center gap-1 border-t border-m3-outline-variant pt-3">
            <button
              onClick={() => handleViewProyectos(espacio.id)}
              className="rounded p-1.5 text-m3-secondary hover:bg-m3-surface-container-high"
              title="Ver proyectos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(espacio);
              }}
              className="rounded p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary"
              title="Editar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(espacio);
              }}
              className="rounded p-1.5 text-m3-on-surface-variant hover:bg-m3-error-container/20 hover:text-m3-error"
              title="Eliminar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface EspaciosClientProps {
  initialEspacios: Espacio[];
}

export function EspaciosClient({ initialEspacios }: EspaciosClientProps) {
  const [espacios, setEspacios] = useState<Espacio[]>(initialEspacios);
  const [editingEspacio, setEditingEspacio] = useState<Espacio | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isModalOpen = showCreateForm || editingEspacio !== null;

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

      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={openCreateModal}
          className="rounded bg-m3-secondary-container px-4 py-2 font-label text-label-lg font-semibold text-m3-on-secondary-container transition-colors hover:bg-m3-secondary-fixed"
        >
          + Crear espacio
        </button>
      </div>

      {/* Modal */}
      <dialog
        ref={dialogRef}
        onClick={handleDialogClick}
        className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50"
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

      {/* Espacios List */}
      <div>
        <h3 className="mb-3 font-headline text-headline-md text-m3-primary">
          Espacios activos
        </h3>
        <EspaciosList espacios={espacios} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  );
}
