"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsableSelect } from "./responsable-select";
import { ScriptFileInput } from "./script-file-input";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

interface CreateCasoFormProps {
  proyectoId?: string;
  proyectos?: ProyectoOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateCasoForm({ proyectoId, proyectos, onSuccess, onCancel }: CreateCasoFormProps) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [responsableId, setResponsableId] = useState("");
  const [selectedProyectoId, setSelectedProyectoId] = useState(proyectoId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scriptFile) {
      setError("Debes seleccionar un archivo de script");
      return;
    }

    if (!responsableId) {
      setError("Debes seleccionar un responsable");
      return;
    }

    if (!selectedProyectoId) {
      setError("Debes seleccionar un proyecto");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("codigo", codigo);
      formData.append("nombre", nombre);
      formData.append("scriptFile", scriptFile);
      formData.append("responsableId", responsableId);
      formData.append("proyectoId", selectedProyectoId);

      const res = await fetch("/api/casos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setCodigo("");
        setNombre("");
        setScriptFile(null);
        setResponsableId("");
        if (!proyectoId) {
          setSelectedProyectoId("");
        }
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else if (res.status === 400) {
        const data = await res.json();
        setError(data.message || "Datos inválidos");
      } else if (res.status === 409) {
        const data = await res.json();
        setError(data.message || "Código duplicado");
      } else if (res.status === 403) {
        setError("No tienes permisos para crear casos");
      } else {
        setError("Error al crear el caso");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-sm">
      <h2 className="mb-4 font-headline text-headline-md text-m3-primary">Nuevo Caso de Prueba</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!proyectoId && proyectos && proyectos.length > 0 && (
          <div>
            <label htmlFor="proyecto" className="block text-sm font-medium text-m3-on-surface">
              Proyecto
            </label>
            <select
              id="proyecto"
              value={selectedProyectoId}
              onChange={(e) => setSelectedProyectoId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((proyecto) => (
                <option key={proyecto.id} value={proyecto.id}>
                  {proyecto.nombre} ({proyecto.espacioNombre})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-m3-on-surface">
            Código
          </label>
          <input
            id="codigo"
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
          <label htmlFor="nombre" className="block text-sm font-medium text-m3-on-surface">
            Nombre del caso
          </label>
          <input
            id="nombre"
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
          <label htmlFor="scriptFile" className="block text-sm font-medium text-m3-on-surface">
            Script de Playwright
          </label>
          <ScriptFileInput
            onChange={setScriptFile}
            disabled={!selectedProyectoId}
          />
        </div>

        <div>
          <label htmlFor="responsable" className="block text-sm font-medium text-m3-on-surface">
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
            {loading ? "Creando..." : "Crear Caso"}
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
