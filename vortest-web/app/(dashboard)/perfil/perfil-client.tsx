"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

interface PerfilClientProps {
  nombreActual: string | null;
  email: string;
}

export function PerfilClient({ nombreActual, email }: PerfilClientProps) {
  const router = useRouter();
  const toast = useToast();

  // --- Dirty state tracking (Issue #2: unsaved changes warning) ---
  const [isDirty, setIsDirty] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Track dirty on any form field change
  function markDirty() {
    setIsDirty(true);
  }

  // beforeunload handler
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Con cambios sin guardar, los enlaces internos (migas, menú) piden confirmación antes de salir.
  useEffect(() => {
    if (!isDirty) return;
    function alHacerClic(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || enlace.target === "_blank" || enlace.hasAttribute("download")) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin || destino.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingUrl(destino.pathname + destino.search);
    }
    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, [isDirty]);

  function confirmLeave() {
    const url = pendingUrl;
    setPendingUrl(null);
    if (url) {
      setIsDirty(false);
      router.push(url);
    }
  }

  // --- Datos de la cuenta (nombre) ---
  const [nombre, setNombre] = useState(nombreActual ?? "");
  const [savingNombre, setSavingNombre] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);

  async function handleGuardarNombre(e: React.FormEvent) {
    e.preventDefault();
    setSavingNombre(true);
    setNombreError(null);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNombreError(body.message ?? body.error ?? "No se pudo guardar el nombre");
        return;
      }
      toast({ tone: "success", title: "Nombre actualizado" });
      setIsDirty(false);
      router.refresh();
    } catch {
      setNombreError("Error de conexión");
    } finally {
      setSavingNombre(false);
    }
  }

  // --- Seguridad (cambiar contraseña) ---
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [erroresPassword, setErroresPassword] = useState<{ actual?: string; nueva?: string; confirmar?: string }>({});

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    const errores: { actual?: string; nueva?: string; confirmar?: string } = {};
    if (!actual) errores.actual = "Escribe tu contraseña actual";
    if (nueva.length < 8) errores.nueva = "La nueva contraseña debe tener al menos 8 caracteres";
    else if (nueva !== confirmar) errores.confirmar = "La confirmación no coincide con la nueva contraseña";
    setErroresPassword(errores);
    const primero = (["actual", "nueva", "confirmar"] as const).find((k) => errores[k]);
    if (primero) {
      document.getElementById(primero)?.focus();
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/perfil/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPasswordError(body.message ?? body.error ?? "No se pudo cambiar la contraseña");
        return;
      }
      toast({ tone: "success", title: "Contraseña actualizada" });
      setActual("");
      setNueva("");
      setConfirmar("");
      setIsDirty(false);
    } catch {
      setPasswordError("Sin conexión con el servidor. Intenta de nuevo.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ConfirmDialog
        open={pendingUrl !== null}
        title="Tienes cambios sin guardar"
        description="¿Seguro que quieres salir?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        onConfirm={confirmLeave}
        onCancel={() => setPendingUrl(null)}
      />
      {/* Datos de la cuenta */}
      <section className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-card">
        <h3 className="font-headline text-headline-md text-m3-on-surface">Datos de la cuenta</h3>
        {/* Issue #12: fixed copy */}
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          Tu correo es {email}. Para cambiarlo, contacta a un administrador.
        </p>
        <form onSubmit={handleGuardarNombre} className="mt-4 flex flex-col gap-4">
          <div>
            <Field label="Nombre para mostrar" id="nombre" error={nombreError}>
              <Input
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  markDirty();
                }}
                maxLength={100}
                placeholder="ej. Gabriel Gutiérrez"
              />
            </Field>
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={savingNombre} loadingText="Guardando…">
              Guardar cambios
            </Button>
            {isDirty && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNombre(nombreActual ?? "");
                  setIsDirty(false);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Seguridad */}
      <section className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-card">
        <h3 className="font-headline text-headline-md text-m3-on-surface">Seguridad</h3>
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          Cambia tu contraseña. Necesitas confirmar la actual.
        </p>
        <form onSubmit={handleCambiarPassword} className="mt-4 flex flex-col gap-4">
          <Field label="Contraseña actual" id="actual" required error={erroresPassword.actual}>
            <Input
              type="password"
              value={actual}
              onChange={(e) => {
                setActual(e.target.value);
                markDirty();
              }}
              autoComplete="current-password"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nueva contraseña" id="nueva" required error={erroresPassword.nueva} hint="Al menos 8 caracteres.">
              <Input
                type="password"
                value={nueva}
                onChange={(e) => {
                  setNueva(e.target.value);
                  markDirty();
                }}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nueva contraseña" id="confirmar" required error={erroresPassword.confirmar}>
              <Input
                type="password"
                value={confirmar}
                onChange={(e) => {
                  setConfirmar(e.target.value);
                  markDirty();
                }}
                autoComplete="new-password"
              />
            </Field>
          </div>
          {passwordError && <Alert tone="error">{passwordError}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" loading={savingPassword} loadingText="Cambiando…">
              Cambiar contraseña
            </Button>
            {isDirty && (
              <Button
                variant="secondary"
                onClick={() => {
                  setActual("");
                  setNueva("");
                  setConfirmar("");
                  setIsDirty(false);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
