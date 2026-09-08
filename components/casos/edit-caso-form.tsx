"use client";

import { useState } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { ResponsableSelect } from "./responsable-select";
import { ScriptFileInput } from "./script-file-input";

interface EditCasoFormProps {
  caso: CasoPruebaListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditCasoForm({ caso, onSuccess, onCancel }: EditCasoFormProps) {
  const [codigo, setCodigo] = useState(caso.codigo);
  const [nombre, setNombre] = useState(caso.nombre);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [responsableId, setResponsableId] = useState(caso.responsableId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("codigo", codigo);
      formData.append("nombre", nombre);
      formData.append("responsableId", responsableId);

      if (scriptFile) {
        formData.append("scriptFile", scriptFile);
      }

      const res = await fetch(`/api/casos/${caso.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        if (onSuccess) {
          onSuccess();
        }
      } else if (res.status === 400) {
        const data = await res.json();
        setError(data.message || "Datos inválidos");
      } else if (res.status === 409) {
        const data = await res.json();
        setError(data.message || "Código duplicado");
      } else if (res.status === 403) {
        setError("No tienes permisos para editar casos");
      } else {
        setError("Error al actualizar el caso");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-sm">
      <h2 className="mb-4 font-headline text-headline-md text-m3-primary">Editar Caso de Prueba</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="edit-codigo" className="block text-sm font-medium text-m3-on-surface">
            Código
          </label>
          <input
            id="edit-codigo"
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
            maxLength={50}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: CP-LOGIN-01"
          />
        </div>

        <div>
          <label htmlFor="edit-nombre" className="block text-sm font-medium text-m3-on-surface">
            Nombre del caso
          </label>
          <input
            id="edit-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={200}
            className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            placeholder="Ej: Login con credenciales válidas"
          />
        </div>

        <div>
          <label htmlFor="edit-scriptFile" className="block text-sm font-medium text-m3-on-surface">
            Script de Playwright
          </label>
          <ScriptFileInput
            fileName={caso.scriptFileName}
            onChange={setScriptFile}
          />
        </div>

        <div>
          <label htmlFor="edit-responsable" className="block text-sm font-medium text-m3-on-surface">
            Responsable
          </label>
          <ResponsableSelect value={responsableId} onChange={setResponsableId} />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-m3-error">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-m3-outline-variant px-4 py-2 text-sm font-medium text-m3-on-surface transition-colors hover:bg-m3-surface-container-high"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
