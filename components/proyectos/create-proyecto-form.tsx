"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ColorPicker } from "@/components/ui/color-picker";

interface EspacioOption {
  id: string;
  nombre: string;
  color: string;
}

interface CreateProyectoFormProps {
  espacioId?: string;
  espacios?: EspacioOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateProyectoForm({ espacioId, espacios, onSuccess, onCancel }: CreateProyectoFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [color, setColor] = useState("#C9822F");
  const [selectedEspacioId, setSelectedEspacioId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEspacioSelect = !espacioId && espacios && espacios.length > 0;
  const effectiveEspacioId = espacioId || selectedEspacioId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsEspacioSelect && !selectedEspacioId) {
      setError("Debes seleccionar un espacio");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, ambiente, espacioId: effectiveEspacioId, color }),
      });

      if (res.ok) {
        setNombre("");
        setAmbiente("");
        setSelectedEspacioId("");
        setColor("#C9822F");
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else if (res.status === 400) {
        const data = await res.json();
        setError(data.message || "Datos inválidos");
      } else if (res.status === 403) {
        setError("No tienes permisos para crear proyectos");
      } else {
        setError("Error al crear el proyecto");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={() => onCancel?.()} labelledBy="create-proyecto-title" className="max-w-md">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-proyecto-title" className="font-headline text-headline-md text-m3-primary">
            Nuevo Proyecto
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cerrar"
              className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {needsEspacioSelect && (
          <div>
            <label htmlFor="espacio" className="block text-sm font-medium text-m3-on-surface">
              Espacio
            </label>
            <select
              id="espacio"
              value={selectedEspacioId}
              onChange={(e) => setSelectedEspacioId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            >
              <option value="">Selecciona un espacio</option>
              {espacios.map((espacio) => (
                <option key={espacio.id} value={espacio.id}>
                  {espacio.nombre}
                </option>
              ))}
            </select>
            {selectedEspacioId && (
              <div className="mt-2 flex items-center gap-2">
                {espacios
                  .filter((e) => e.id === selectedEspacioId)
                  .map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1.5 text-sm text-m3-on-surface">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: e.color }}
                      />
                      {e.nombre}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-m3-on-surface">
            Nombre del proyecto
          </label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: Tests QA Bancoomeva"
          />
        </div>

        <div>
          <label htmlFor="ambiente" className="block text-sm font-medium text-m3-on-surface">
            Ambiente
          </label>
          <input
            id="ambiente"
            type="text"
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            required
            maxLength={50}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: QA, PROD, DEV"
          />
        </div>

        <ColorPicker name="color" value={color} onChange={setColor} />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-m3-error">
            {error}
          </div>
        )}

        <div className="mt-1 flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-label text-label-md font-semibold text-m3-on-surface-variant hover:underline"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-m3-primary px-5 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Proyecto"}
          </button>
        </div>
      </form>
      </div>
    </Modal>
  );
}
