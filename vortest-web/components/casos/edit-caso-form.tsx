"use client";

import { useEffect, useRef, useState } from "react";
import type { CasoPruebaListItem } from "@/types/caso";
import { ResponsableSelect } from "./responsable-select";
import { ScriptFileInput } from "./script-file-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

interface EditCasoFormProps {
  caso: CasoPruebaListItem;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Avisa al modal contenedor si hay cambios sin guardar, para no perderlos al cerrar. */
  onCambiosChange?: (hayCambios: boolean) => void;
}

type Errores = Partial<Record<"codigo" | "nombre", string>>;

export function EditCasoForm({ caso, onSuccess, onCancel, onCambiosChange }: EditCasoFormProps) {
  const toast = useToast();
  const [codigo, setCodigo] = useState(caso.codigo);
  const [nombre, setNombre] = useState(caso.nombre);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [responsableId, setResponsableId] = useState(caso.responsableId);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const refs = { codigo: useRef<HTMLInputElement>(null), nombre: useRef<HTMLInputElement>(null) };

  const hayCambios = codigo !== caso.codigo || nombre !== caso.nombre || scriptFile !== null || responsableId !== caso.responsableId;
  useEffect(() => onCambiosChange?.(hayCambios), [hayCambios, onCambiosChange]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const e: Errores = {};
    if (!codigo.trim()) e.codigo = "Escribe el código del caso";
    if (!nombre.trim()) e.nombre = "Escribe el nombre del caso";
    setErrores(e);
    const primero = (["codigo", "nombre"] as const).find((k) => e[k]);
    if (primero) {
      refs[primero].current?.focus();
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("codigo", codigo);
      formData.append("nombre", nombre);
      formData.append("responsableId", responsableId);
      if (scriptFile) formData.append("scriptFile", scriptFile);

      const res = await fetch(`/api/casos/${caso.id}`, { method: "PUT", body: formData });

      if (res.ok) {
        toast({ tone: "success", title: "Caso actualizado", description: `${codigo} · ${nombre}` });
        onSuccess?.();
      } else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Datos inválidos");
      } else if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        const mensaje = data.message || "Ya existe otro caso con ese código";
        setErrores({ codigo: mensaje });
        refs.codigo.current?.focus();
      } else if (res.status === 403) {
        setError("No tienes permisos para editar casos");
      } else {
        setError(`No se pudo guardar (el servidor respondió ${res.status}). Intenta de nuevo.`);
      }
    } catch {
      setError("Sin conexión con el servidor. Tus cambios siguen en el formulario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Código" id="edit-codigo" required error={errores.codigo}>
        <Input ref={refs.codigo} value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={50} placeholder="Ej: CP-LOGIN-01" />
      </Field>

      <Field label="Nombre del caso" id="edit-nombre" required error={errores.nombre}>
        <Input ref={refs.nombre} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} placeholder="Ej: Login con credenciales válidas" />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="scriptFile-input" className="font-label text-label-md text-m3-on-surface">
          Script de Playwright
        </label>
        <ScriptFileInput fileName={caso.scriptFileName} onChange={setScriptFile} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="responsable" className="font-label text-label-md text-m3-on-surface">
          Responsable
        </label>
        <ResponsableSelect value={responsableId} onChange={setResponsableId} />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mt-1 flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} loadingText="Guardando…">
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
