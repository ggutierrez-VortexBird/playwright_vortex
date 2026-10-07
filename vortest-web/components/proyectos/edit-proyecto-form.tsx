"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface EditProyectoFormProps {
  proyecto: ProyectoWithMetrics;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type Errores = Partial<Record<"nombre" | "ambiente", string>>;

export function EditProyectoForm({ proyecto, onSuccess, onCancel }: EditProyectoFormProps) {
  const toast = useToast();
  const inicial = {
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    versionSistema: proyecto.versionSistema ?? "",
    descripcion: proyecto.descripcion ?? "",
    color: proyecto.color ?? "#C9822F",
    activo: proyecto.activo,
  };
  const [form, setForm] = useState(inicial);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const ambienteRef = useRef<HTMLInputElement>(null);
  const hayCambios = JSON.stringify(form) !== JSON.stringify(inicial);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const e: Errores = {};
    if (!form.nombre.trim()) e.nombre = "Escribe el nombre del proyecto";
    if (!form.ambiente.trim()) e.ambiente = "Indica el ambiente, p. ej. QA";
    setErrores(e);
    const primero = (["nombre", "ambiente"] as const).find((k) => e[k]);
    if (primero) {
      ({ nombre: nombreRef, ambiente: ambienteRef })[primero].current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast({ tone: "success", title: "Cambios guardados", description: form.nombre });
        onSuccess?.();
      } else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Datos inválidos");
      } else if (res.status === 403) {
        setError("No tienes permisos para editar proyectos");
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
    <Modal open onClose={() => onCancel?.()} labelledBy="edit-proyecto-title" className="max-w-md" hayCambios={hayCambios}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-proyecto-title" className="font-headline text-headline-md text-m3-on-surface">
            Editar proyecto
          </h2>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Cerrar">
              <Icon name="close" />
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Nombre del proyecto" id="edit-nombre" required error={errores.nombre}>
            <Input ref={nombreRef} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={100} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ambiente" id="edit-ambiente" required error={errores.ambiente}>
              <Input ref={ambienteRef} value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value })} maxLength={50} />
            </Field>
            <Field label="Versión de sistema" id="edit-version">
              <Input value={form.versionSistema} onChange={(e) => setForm({ ...form, versionSistema: e.target.value })} maxLength={50} placeholder="Ej: v2.4.1" />
            </Field>
          </div>

          <Field label="Descripción" id="edit-descripcion">
            <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} maxLength={500} />
          </Field>

          <ColorPicker name="color" value={form.color} onChange={(color) => setForm({ ...form, color })} />

          <div className="flex items-center justify-between gap-4 rounded-md border border-m3-outline-variant px-3.5 py-3">
            <div>
              <div className="font-label text-label-md font-semibold text-m3-on-surface">Proyecto activo</div>
              <p className="font-body text-body-sm text-m3-on-surface-variant">Los testers pueden ejecutar casos y ver resultados.</p>
            </div>
            <Switch checked={form.activo} onCheckedChange={(activo) => setForm({ ...form, activo })} aria-label="Proyecto activo" />
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
      </div>
    </Modal>
  );
}
