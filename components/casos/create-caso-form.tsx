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
  /** Cuando es true, omite el overlay/tarjeta propios (el contenedor padre ya los provee). */
  embedded?: boolean;
}

export function CreateCasoForm({ proyectoId, proyectos, onSuccess, onCancel, embedded }: CreateCasoFormProps) {
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

  const formBody = (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!proyectoId && proyectos && proyectos.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="proyecto" className="font-label text-label-sm font-semibold text-m3-on-surface">
                Proyecto
              </label>
              <select
                id="proyecto"
                value={selectedProyectoId}
                onChange={(e) => setSelectedProyectoId(e.target.value)}
                required
                className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
              >
                <option value="">Selecciona un proyecto</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre} · {proyecto.espacioNombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="codigo" className="font-label text-label-sm font-semibold text-m3-on-surface">
                Código
              </label>
              <input
                id="codigo"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                maxLength={50}
                className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
                placeholder="Ej: CP-LOGIN-01"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="responsable" className="font-label text-label-sm font-semibold text-m3-on-surface">
                Responsable
              </label>
              <ResponsableSelect value={responsableId} onChange={setResponsableId} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="nombre" className="font-label text-label-sm font-semibold text-m3-on-surface">
              Nombre del caso
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={200}
              className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
              placeholder="Ej: Login con credenciales válidas"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="scriptFile" className="font-label text-label-sm font-semibold text-m3-on-surface">
              Script de Playwright
            </label>
            <ScriptFileInput
              onChange={setScriptFile}
              disabled={!selectedProyectoId}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-m3-danger-container p-3 font-body text-body-sm text-m3-error">
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
              {loading ? "Creando..." : "Crear caso"}
            </button>
          </div>
        </form>
  );

  if (embedded) {
    return formBody;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-m3-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-headline-md text-m3-on-surface">Nuevo caso de prueba</h2>
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
        {formBody}
      </div>
    </div>
  );
}
