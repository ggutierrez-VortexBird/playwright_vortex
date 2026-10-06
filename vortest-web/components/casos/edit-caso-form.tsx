"use client";

import { useState } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { ResponsableSelect } from "./responsable-select";
import { ScriptFileInput } from "./script-file-input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-codigo" className="font-label text-label-sm font-semibold text-m3-on-surface">
          Código
        </label>
        <input
          id="edit-codigo"
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          maxLength={50}
          className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant transition-shadow focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
          placeholder="Ej: CP-LOGIN-01"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-nombre" className="font-label text-label-sm font-semibold text-m3-on-surface">
          Nombre del caso
        </label>
        <input
          id="edit-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          maxLength={200}
          className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant transition-shadow focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
          placeholder="Ej: Login con credenciales válidas"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-scriptFile" className="font-label text-label-sm font-semibold text-m3-on-surface">
          Script de Playwright
        </label>
        <ScriptFileInput
          fileName={caso.scriptFileName}
          onChange={setScriptFile}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-responsable" className="font-label text-label-sm font-semibold text-m3-on-surface">
          Responsable
        </label>
        <ResponsableSelect value={responsableId} onChange={setResponsableId} />
      </div>

      {error && (
        <p role="alert" className="font-body text-body-sm text-m3-error">
          {error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
