"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

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

const COLOR_INICIAL = "#C9822F";

type Errores = Partial<Record<"espacio" | "nombre" | "ambiente", string>>;

export function CreateProyectoForm({ espacioId, espacios, onSuccess, onCancel }: CreateProyectoFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [color, setColor] = useState(COLOR_INICIAL);
  const [selectedEspacioId, setSelectedEspacioId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const espacioRef = useRef<HTMLSelectElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const ambienteRef = useRef<HTMLInputElement>(null);

  const needsEspacioSelect = !espacioId && espacios && espacios.length > 0;
  const effectiveEspacioId = espacioId || selectedEspacioId;
  const hayCambios = Boolean(nombre || ambiente || selectedEspacioId || color !== COLOR_INICIAL);
  const espacioElegido = espacios?.find((e) => e.id === selectedEspacioId);

  function validar(): Errores {
    const e: Errores = {};
    if (needsEspacioSelect && !selectedEspacioId) e.espacio = "Debes seleccionar un espacio";
    if (!nombre.trim()) e.nombre = "Escribe el nombre del proyecto";
    if (!ambiente.trim()) e.ambiente = "Indica el ambiente, p. ej. QA";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const e = validar();
    setErrores(e);
    const primero = (["espacio", "nombre", "ambiente"] as const).find((k) => e[k]);
    if (primero) {
      ({ espacio: espacioRef, nombre: nombreRef, ambiente: ambienteRef })[primero].current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), ambiente: ambiente.trim(), espacioId: effectiveEspacioId, color }),
      });

      if (res.ok) {
        toast({ tone: "success", title: "Proyecto creado", description: nombre.trim() });
        setNombre("");
        setAmbiente("");
        setSelectedEspacioId("");
        setColor(COLOR_INICIAL);
        if (onSuccess) onSuccess();
        else router.refresh();
      } else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Datos inválidos");
      } else if (res.status === 403) {
        setError("No tienes permisos para crear proyectos");
      } else {
        setError(`No se pudo crear el proyecto (el servidor respondió ${res.status}). Intenta de nuevo.`);
      }
    } catch {
      setError("Sin conexión con el servidor. Tus datos siguen en el formulario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={() => onCancel?.()} labelledBy="create-proyecto-title" className="max-w-md" hayCambios={hayCambios}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-proyecto-title" className="font-headline text-headline-md text-m3-on-surface">
            Nuevo proyecto
          </h2>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Cerrar">
              <Icon name="close" />
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {needsEspacioSelect && (
            <Field label="Espacio" id="espacio" required error={errores.espacio}>
              <Select ref={espacioRef} value={selectedEspacioId} onChange={(e) => setSelectedEspacioId(e.target.value)}>
                <option value="">Selecciona un espacio</option>
                {espacios.map((espacio) => (
                  <option key={espacio.id} value={espacio.id}>
                    {espacio.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {espacioElegido && (
            <span className="-mt-2 inline-flex items-center gap-1.5 font-body text-body-sm text-m3-on-surface-variant">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: espacioElegido.color }} aria-hidden="true" />
              {espacioElegido.nombre}
            </span>
          )}

          <Field label="Nombre del proyecto" id="nombre" required error={errores.nombre}>
            <Input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} placeholder="Ej: Tests QA Bancoomeva" />
          </Field>

          <Field label="Ambiente" id="ambiente" required error={errores.ambiente}>
            <Input ref={ambienteRef} value={ambiente} onChange={(e) => setAmbiente(e.target.value)} maxLength={50} placeholder="Ej: QA, PROD, DEV" />
          </Field>

          <ColorPicker name="color" value={color} onChange={setColor} />

          {error && <Alert tone="error">{error}</Alert>}

          <div className="mt-1 flex justify-end gap-3">
            {onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" loading={loading} loadingText="Creando…">
              Crear proyecto
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
