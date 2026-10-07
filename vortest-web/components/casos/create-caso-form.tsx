"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsableSelect } from "./responsable-select";
import { ScriptFileInput } from "./script-file-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

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

type CampoCaso = "proyecto" | "codigo" | "nombre" | "script" | "responsable";
const ORDEN_CAMPOS: CampoCaso[] = ["proyecto", "codigo", "nombre", "script", "responsable"];
const ID_CONTROL: Record<CampoCaso, string> = {
  proyecto: "proyecto",
  codigo: "codigo",
  nombre: "nombre",
  script: "scriptFile-input",
  responsable: "responsable",
};

function ErrorDeCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p id={id} className="flex items-center gap-1 font-body text-body-xs text-m3-error">
      <Icon name="error" size={14} filled />
      {mensaje}
    </p>
  );
}

export function CreateCasoForm({ proyectoId, proyectos, onSuccess, onCancel }: CreateCasoFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [responsableId, setResponsableId] = useState("");
  const [selectedProyectoId, setSelectedProyectoId] = useState(proyectoId || "");
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<CampoCaso, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const necesitaProyecto = !proyectoId && Boolean(proyectos && proyectos.length > 0);

  function mostrarErrores(e: Partial<Record<CampoCaso, string>>) {
    setErrores(e);
    const primero = ORDEN_CAMPOS.find((c) => e[c]);
    if (primero) document.getElementById(ID_CONTROL[primero])?.focus();
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);

    const e: Partial<Record<CampoCaso, string>> = {};
    if (necesitaProyecto && !selectedProyectoId) e.proyecto = "Debes seleccionar un proyecto";
    if (!codigo.trim()) e.codigo = "Escribe un código, p. ej. CP-LOGIN-01";
    if (!nombre.trim()) e.nombre = "Escribe el nombre del caso";
    if (!scriptFile) e.script = "Debes seleccionar un archivo de script";
    if (!responsableId) e.responsable = "Debes seleccionar un responsable";
    if (!necesitaProyecto && !selectedProyectoId) e.proyecto = "Debes seleccionar un proyecto";
    if (Object.keys(e).length) {
      mostrarErrores(e);
      return;
    }
    setErrores({});
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("codigo", codigo);
      formData.append("nombre", nombre);
      formData.append("scriptFile", scriptFile!);
      formData.append("responsableId", responsableId);
      formData.append("proyectoId", selectedProyectoId);

      const res = await fetch("/api/casos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast({ tone: "success", title: "Caso creado", description: `${codigo} · ${nombre}` });
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
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Datos inválidos");
      } else if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        mostrarErrores({ codigo: data.message || "Ya existe un caso con ese código en el proyecto" });
      } else if (res.status === 403) {
        setError("No tienes permisos para crear casos");
      } else {
        setError(`No se pudo crear el caso (el servidor respondió ${res.status}). Intenta de nuevo.`);
      }
    } catch {
      setError("Sin conexión con el servidor. Tus datos siguen en el formulario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {necesitaProyecto && (
        <Field label="Proyecto" id="proyecto" required error={errores.proyecto}>
          <Select value={selectedProyectoId} onChange={(e) => setSelectedProyectoId(e.target.value)}>
            <option value="">Selecciona un proyecto</option>
            {proyectos!.map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>
                {proyecto.nombre} · {proyecto.espacioNombre}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Código" id="codigo" required error={errores.codigo}>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={50} placeholder="Ej: CP-LOGIN-01" />
        </Field>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="responsable" className="font-label text-label-md text-m3-on-surface after:ml-0.5 after:text-m3-error after:content-['*']">
            Responsable
          </label>
          <ResponsableSelect value={responsableId} onChange={setResponsableId} />
          <ErrorDeCampo id="responsable-error" mensaje={errores.responsable} />
        </div>
      </div>

      <Field label="Nombre del caso" id="nombre" required error={errores.nombre}>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} placeholder="Ej: Login con credenciales válidas" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="scriptFile-input" className="font-label text-label-md text-m3-on-surface after:ml-0.5 after:text-m3-error after:content-['*']">
          Script de Playwright
        </label>
        <ScriptFileInput onChange={setScriptFile} disabled={!selectedProyectoId} />
        <ErrorDeCampo id="script-error" mensaje={errores.script} />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mt-1 flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} loadingText="Creando…">
          Crear caso
        </Button>
      </div>
    </form>
  );
}
