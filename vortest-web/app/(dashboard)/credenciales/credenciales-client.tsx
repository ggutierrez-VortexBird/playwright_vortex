"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatFecha } from "@/lib/format";
import type { CredencialResumen } from "@/lib/credenciales/gestion";

interface ProyectoOpcion {
  id: string;
  nombre: string;
  espacio: string;
}

interface Props {
  credenciales: CredencialResumen[];
  proyectos: ProyectoOpcion[];
}

type Errores = Partial<Record<"proyectoId" | "nombre" | "storageState" | "vence", string>>;

const VACIO = { proyectoId: "", nombre: "", storageState: "", vence: "" };

function estadoVencimiento(vence: string | null) {
  if (!vence) return null;
  const restante = new Date(vence).getTime() - Date.now();
  if (restante < 0) return { tone: "error" as const, icon: "event_busy", label: "Sesión vencida" };
  if (restante < 3 * 24 * 3600 * 1000) return { tone: "warning" as const, icon: "schedule", label: "Vence pronto" };
  return { tone: "success" as const, icon: "event_available", label: "Vigente" };
}

export function CredencialesClient({ credenciales, proyectos }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aEliminar, setAEliminar] = useState<CredencialResumen | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const proyectoIdRef = useRef<HTMLSelectElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const storageStateRef = useRef<HTMLTextAreaElement>(null);
  const venceRef = useRef<HTMLInputElement>(null);

  const hayCambios = JSON.stringify(form) !== JSON.stringify(VACIO);

  function cerrar() {
    setAbierto(false);
    setForm(VACIO);
    setErrores({});
    setErrorGeneral(null);
  }

  function validar(): Errores {
    const e: Errores = {};
    if (!form.proyectoId) e.proyectoId = "Elige un proyecto";
    if (!form.nombre.trim()) e.nombre = "Escribe un nombre";
    if (!form.storageState.trim()) e.storageState = "Pega el storageState o carga el archivo";
    else {
      try {
        const d = JSON.parse(form.storageState);
        if (!Array.isArray(d?.cookies) || !Array.isArray(d?.origins)) e.storageState = "Debe tener las listas `cookies` y `origins` de Playwright";
      } catch {
        e.storageState = "No es un JSON válido";
      }
    }
    return e;
  }

  function enfocarPrimero(e: Errores) {
    const primero = (["proyectoId", "nombre", "storageState", "vence"] as const).find((k) => e[k]);
    if (primero) ({ proyectoId: proyectoIdRef, nombre: nombreRef, storageState: storageStateRef, vence: venceRef })[primero].current?.focus();
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setErrorGeneral(null);
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      enfocarPrimero(e);
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/credenciales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vence: form.vence || null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const campo = data.code?.startsWith("validation:") ? (data.code.split(":")[1] as keyof Errores) : undefined;
        if (campo && campo in ({ proyectoId: proyectoIdRef, nombre: nombreRef, storageState: storageStateRef, vence: venceRef })) {
          const nuevos = { [campo]: data.error ?? "Revisa este campo" };
          setErrores(nuevos);
          enfocarPrimero(nuevos);
        } else {
          setErrorGeneral(data.error ?? `No se pudo guardar (el servidor respondió ${res.status}).`);
        }
        return;
      }
      toast({ tone: "success", title: "Credencial guardada", description: `${form.nombre.trim()} ya se puede usar al grabar en ese proyecto.` });
      cerrar();
      router.refresh();
    } catch {
      setErrorGeneral("Sin conexión con el servidor. Tus datos siguen en el formulario.");
    } finally {
      setGuardando(false);
    }
  }

  async function cargarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const texto = await archivo.text();
    setForm((f) => ({ ...f, storageState: texto, nombre: f.nombre || archivo.name.replace(/\.json$/i, "") }));
    setErrores((x) => ({ ...x, storageState: undefined }));
    e.target.value = "";
  }

  async function eliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      const res = await fetch(`/api/credenciales/${aEliminar.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      toast({ tone: "neutral", title: "Credencial eliminada", description: aEliminar.nombre });
      setAEliminar(null);
      router.refresh();
    } catch {
      toast({ tone: "error", title: "No se pudo eliminar la credencial", description: "Intenta de nuevo en unos segundos." });
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Credenciales"
        subtitle="Sesiones guardadas (storageState de Playwright) para grabar y ejecutar casos ya autenticados. Se guardan cifradas."
        actions={
          proyectos.length > 0 && (
            <Button icon="add" onClick={() => setAbierto(true)}>
              Agregar credencial
            </Button>
          )
        }
      />

      {credenciales.length === 0 ? (
        <EmptyState
          icon="vpn_key"
          title="Todavía no hay credenciales"
          description={
            proyectos.length === 0
              ? "Crea primero un proyecto: cada credencial pertenece a uno."
              : "Agrega el storageState de una sesión iniciada para grabar casos sin repetir el login."
          }
          action={
            proyectos.length > 0 && (
              <Button size="sm" icon="add" onClick={() => setAbierto(true)}>
                Agregar credencial
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-m3-outline-variant">
            {credenciales.map((c) => {
              const v = estadoVencimiento(c.vence);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-m3-primary-fixed text-m3-on-primary-fixed">
                    <Icon name="key" size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-body-md font-semibold text-m3-on-surface">{c.nombre}</p>
                    <p className="truncate font-body text-body-sm text-m3-on-surface-variant">
                      {c.proyecto.espacio} › {c.proyecto.nombre} · creada {formatFecha(c.creada, { hora: false })}
                    </p>
                  </div>
                  <span className="font-body text-body-sm text-m3-on-surface-variant">
                    {c.casosQueLaUsan === 0 ? "Sin casos" : `${c.casosQueLaUsan} ${c.casosQueLaUsan === 1 ? "caso la usa" : "casos la usan"}`}
                  </span>
                  {v && (
                    <StatusBadge tone={v.tone} icon={v.icon} title={`Vence ${formatFecha(c.vence)}`}>
                      {v.label}
                    </StatusBadge>
                  )}
                  <Button variant="ghost" onClick={() => setAEliminar(c)} aria-label={`Eliminar credencial ${c.nombre}`} className="hover:text-m3-error">
                    <Icon name="delete" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal open={abierto} onClose={cerrar} labelledBy="nueva-credencial-titulo" hayCambios={hayCambios} className="max-w-xl">
        <form onSubmit={guardar} noValidate className="flex flex-col gap-5 p-6">
          <div>
            <h2 id="nueva-credencial-titulo" className="font-headline text-headline-md text-m3-on-surface">
              Agregar credencial
            </h2>
            <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
              Exporta la sesión con <code className="font-mono-code text-label-sm">context.storageState()</code> o con el grabador de Playwright y pégala aquí.
            </p>
          </div>
          {errorGeneral && <Alert tone="error">{errorGeneral}</Alert>}
          <Field label="Proyecto" required error={errores.proyectoId}>
            <Select ref={proyectoIdRef} value={form.proyectoId} onChange={(e) => setForm({ ...form, proyectoId: e.target.value })}>
              <option value="">Elige un proyecto…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.espacio} › {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre" required error={errores.nombre} hint="Para reconocerla al grabar, p. ej. “Usuario QA de catastro”.">
            <Input ref={nombreRef} value={form.nombre} maxLength={80} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="storageState (JSON)" required error={errores.storageState}>
            <Textarea
              ref={storageStateRef}
              value={form.storageState}
              onChange={(e) => setForm({ ...form, storageState: e.target.value })}
              rows={6}
              spellCheck={false}
              placeholder='{"cookies": [...], "origins": [...]}'
              className="font-mono-code text-label-sm"
            />
          </Field>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 font-label text-label-md text-m3-primary hover:underline">
            <Icon name="upload_file" size={18} />
            Cargar desde un archivo .json
            <input type="file" accept="application/json,.json" onChange={cargarArchivo} className="sr-only" />
          </label>
          <Field label="La sesión vence" error={errores.vence} hint="Opcional. Te avisamos cuando esté por vencer.">
            <Input ref={venceRef} type="datetime-local" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-3 border-t border-m3-outline-variant pt-4">
            <Button variant="secondary" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando} loadingText="Guardando…">
              Guardar credencial
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={aEliminar !== null}
        title="¿Eliminar la credencial?"
        description={
          aEliminar && aEliminar.casosQueLaUsan > 0
            ? `${aEliminar.casosQueLaUsan === 1 ? "1 caso la usa" : `${aEliminar.casosQueLaUsan} casos la usan`}: desde ahora se ejecutarán sin esa sesión. No se puede deshacer.`
            : "Nadie la está usando. No se puede deshacer."
        }
        itemLabel={aEliminar ? `${aEliminar.nombre} · ${aEliminar.proyecto.nombre}` : undefined}
        confirmLabel="Eliminar"
        isLoading={eliminando}
        onConfirm={eliminar}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
