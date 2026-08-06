"use client";

import { useState } from "react";
import { EspaciosForm } from "./espacios-form";
import type { Espacio } from "@/types/espacio";

interface EspaciosListProps {
  espacios: Espacio[];
  onEdit: (espacio: Espacio) => void;
  onDelete: (espacio: Espacio) => void;
}

function EspaciosList({ espacios, onEdit, onDelete }: EspaciosListProps) {
  if (espacios.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface p-8 text-center">
        <p className="text-ink-3">No hay espacios creados aún.</p>
        <p className="mt-1 text-sm text-ink-3">
          Usa el formulario de arriba para crear el primero.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {espacios.map((espacio) => (
        <div
          key={espacio.id}
          className="flex items-center justify-between rounded-lg border border-rule bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: espacio.color }}
            />
            <span className="font-medium text-ink">{espacio.nombre}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(espacio)}
              className="rounded border border-rule px-3 py-1 text-sm text-ink hover:bg-rule-soft"
            >
              Editar
            </button>
            <button
              onClick={() => onDelete(espacio)}
              className="rounded border border-stamp px-3 py-1 text-sm text-stamp hover:bg-red-50"
            >
              Eliminar
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
    setEditingEspacio(espacio);
    setShowCreateForm(false);
  }

  function handleSuccess() {
    window.location.reload();
  }

  function handleCancel() {
    setEditingEspacio(null);
    setShowCreateForm(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create/Edit Form Section */}
      <div>
        {!showCreateForm && !editingEspacio && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded bg-ink px-4 py-2 text-surface hover:bg-ink-2"
          >
            + Crear espacio
          </button>
        )}

        {showCreateForm && (
          <div className="max-w-md">
            <h3 className="mb-3 text-lg font-semibold text-ink">Nuevo espacio</h3>
            <EspaciosForm onSuccess={handleSuccess} onCancel={handleCancel} />
          </div>
        )}

        {editingEspacio && (
          <div className="max-w-md">
            <h3 className="mb-3 text-lg font-semibold text-ink">Editar espacio</h3>
            <EspaciosForm espacio={editingEspacio} onSuccess={handleSuccess} onCancel={handleCancel} />
          </div>
        )}
      </div>

      {/* Espacios List */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-ink">Espacios activos</h3>
        <EspaciosList espacios={espacios} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  );
}
