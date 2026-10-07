"use client";

import { useEffect, useRef, useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import type { Espacio } from "@/types/espacio";

interface EspaciosFormProps {
  espacio?: Espacio;
  onSuccess: (espacio: Espacio, isEdit: boolean) => void;
  onCancel?: () => void;
  /** Avisa al modal si hay cambios sin guardar. */
  onCambiosChange?: (hayCambios: boolean) => void;
}

const COLOR_INICIAL = "#C9822F";

export function EspaciosForm({ espacio, onSuccess, onCancel, onCambiosChange }: EspaciosFormProps) {
  const [nombre, setNombre] = useState(espacio?.nombre || "");
  const [color, setColor] = useState(espacio?.color || COLOR_INICIAL);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const isEditing = !!espacio;

  const hayCambios = nombre !== (espacio?.nombre || "") || color !== (espacio?.color || COLOR_INICIAL);
  useEffect(() => onCambiosChange?.(hayCambios), [hayCambios, onCambiosChange]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setErrorNombre("Escribe el nombre del espacio");
      nombreRef.current?.focus();
      return;
    }
    setErrorNombre(null);
    setIsLoading(true);

    try {
      const res = await fetch(isEditing ? `/api/espacios/${espacio.id}` : "/api/espacios", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), color }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `No se pudo guardar (el servidor respondió ${res.status}).`);
      }

      const guardado: Espacio = await res.json();
      setNombre("");
      setColor(COLOR_INICIAL);
      onSuccess(guardado, isEditing);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Sin conexión con el servidor. Tus datos siguen en el formulario.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Nombre del espacio" id="nombre" required error={errorNombre}>
        <Input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} placeholder="Ej: Acme Corp" />
      </Field>

      <ColorPicker name="color" value={color} onChange={setColor} />

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mt-1 flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={isLoading} loadingText={isEditing ? "Guardando…" : "Creando…"}>
          {isEditing ? "Guardar cambios" : "Crear espacio"}
        </Button>
      </div>
    </form>
  );
}
