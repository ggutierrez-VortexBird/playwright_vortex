"use client";

import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import type { Espacio } from "@/types/espacio";

interface EspaciosFormProps {
  espacio?: Espacio;
  onSuccess: (espacio: Espacio, isEdit: boolean) => void;
  onCancel?: () => void;
}

export function EspaciosForm({ espacio, onSuccess, onCancel }: EspaciosFormProps) {
  const [nombre, setNombre] = useState(espacio?.nombre || "");
  const [color, setColor] = useState(espacio?.color || "#C9822F");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!espacio;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const method = isEditing ? "PUT" : "POST";
      const url = isEditing
        ? `/api/espacios/${espacio.id}`
        : "/api/espacios";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al guardar");
      }

      const created: Espacio = await res.json();

      setNombre("");
      setColor("#C9822F");
      onSuccess(created, isEditing);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="nombre"
          className="font-label text-label-sm font-semibold text-m3-on-surface"
        >
          Nombre del espacio
        </label>
        <input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Ej: Acme Corp"
          className="rounded border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-secondary focus:border-m3-secondary transition-shadow"
        />
      </div>

      <ColorPicker name="color" value={color} onChange={setColor} />

      {error && (
        <p role="alert" className="font-body text-body-sm text-m3-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 disabled:opacity-50"
        >
          {isLoading
            ? isEditing
              ? "Guardando..."
              : "Creando..."
            : isEditing
            ? "Guardar cambios"
            : "Crear espacio"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
