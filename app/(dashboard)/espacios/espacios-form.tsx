"use client";

import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import type { Espacio } from "@/types/espacio";

interface EspaciosFormProps {
  espacio?: Espacio;
  onSuccess: () => void;
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

      setNombre("");
      setColor("#C9822F");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-rule bg-surface p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium text-ink">
          Nombre del espacio
        </label>
        <input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Ej: Acme Corp"
          className="rounded border border-rule px-3 py-2"
        />
      </div>

      <ColorPicker name="color" value={color} onChange={setColor} />

      {error && (
        <p role="alert" className="text-sm text-stamp">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded bg-ink px-4 py-2 text-surface hover:bg-ink-2 disabled:opacity-50"
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
            className="rounded border border-rule px-4 py-2 text-ink hover:bg-rule-soft"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
