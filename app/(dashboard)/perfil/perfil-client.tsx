"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PerfilClientProps {
  nombreActual: string | null;
  email: string;
}

export function PerfilClient({ nombreActual, email }: PerfilClientProps) {
  const router = useRouter();

  // --- Dirty state tracking (Issue #2: unsaved changes warning) ---
  const [isDirty, setIsDirty] = useState(false);

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

  // Intercept Next.js client-side navigation when dirty
  const routerPush = useCallback(
    (url: string) => {
      if (!isDirty) {
        router.push(url);
        return;
      }
      const confirmed = window.confirm(
        "Tienes cambios sin guardar. ¿Seguro que quieres salir?"
      );
      if (confirmed) {
        setIsDirty(false);
        router.push(url);
      }
    },
    [isDirty, router]
  );

  // Expose routerPush globally so next/link components can use it via onClick
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__dirtyRouterPush = routerPush;
  }, [routerPush]);

  // --- Datos de la cuenta (nombre) ---
  const [nombre, setNombre] = useState(nombreActual ?? "");
  const [savingNombre, setSavingNombre] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [nombreOk, setNombreOk] = useState(false);

  async function handleGuardarNombre(e: React.FormEvent) {
    e.preventDefault();
    setSavingNombre(true);
    setNombreError(null);
    setNombreOk(false);
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
      setNombreOk(true);
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
  const [passwordOk, setPasswordOk] = useState(false);

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordOk(false);

    if (nueva.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (nueva !== confirmar) {
      setPasswordError("La confirmación no coincide con la nueva contraseña");
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
      setPasswordOk(true);
      setActual("");
      setNueva("");
      setConfirmar("");
      setIsDirty(false);
    } catch {
      setPasswordError("Error de conexión");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Datos de la cuenta */}
      <section className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-card">
        <h3 className="font-headline text-headline-md text-m3-primary">Datos de la cuenta</h3>
        {/* Issue #12: fixed copy */}
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          Tu correo es {email}. Para cambiarlo, contacta a un administrador.
        </p>
        <form onSubmit={handleGuardarNombre} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="nombre" className="mb-1.5 block font-label text-label-sm font-medium text-m3-on-surface">
              Nombre para mostrar
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setNombreOk(false);
                markDirty();
              }}
              maxLength={100}
              placeholder="ej. Gabriel Gutiérrez"
              className="w-full rounded-lg border border-m3-outline bg-m3-surface-container-lowest px-3 py-2.5 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>
          {nombreError && (
            <p role="alert" className="flex items-center gap-1 font-body text-body-sm text-m3-error">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {nombreError}
            </p>
          )}
          {nombreOk && (
            <p className="flex items-center gap-1 font-body text-body-sm text-m3-tertiary">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Nombre actualizado.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingNombre}
              className="flex items-center gap-2 rounded-lg bg-m3-primary px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity duration-200"
            >
              {savingNombre && (
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              )}
              {savingNombre ? "Guardando…" : "Guardar cambios"}
            </button>
            {isDirty && (
              <button
                type="button"
                onClick={() => {
                  setNombre(nombreActual ?? "");
                  setIsDirty(false);
                }}
                className="rounded-lg border border-m3-outline-variant px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors duration-200"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Seguridad */}
      <section className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 shadow-card">
        <h3 className="font-headline text-headline-md text-m3-primary">Seguridad</h3>
        <p className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
          Cambia tu contraseña. Necesitas confirmar la actual.
        </p>
        <form onSubmit={handleCambiarPassword} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="actual" className="mb-1.5 block font-label text-label-sm font-medium text-m3-on-surface">
              Contraseña actual
            </label>
            <input
              id="actual"
              type="password"
              value={actual}
              onChange={(e) => {
                setActual(e.target.value);
                markDirty();
              }}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-m3-outline bg-m3-surface-container-lowest px-3 py-2.5 font-body text-body-md text-m3-on-surface focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nueva" className="mb-1.5 block font-label text-label-sm font-medium text-m3-on-surface">
                Nueva contraseña
              </label>
              <input
                id="nueva"
                type="password"
                value={nueva}
                onChange={(e) => {
                  setNueva(e.target.value);
                  markDirty();
                }}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-m3-outline bg-m3-surface-container-lowest px-3 py-2.5 font-body text-body-md text-m3-on-surface focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary"
              />
            </div>
            <div>
              <label htmlFor="confirmar" className="mb-1.5 block font-label text-label-sm font-medium text-m3-on-surface">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => {
                  setConfirmar(e.target.value);
                  markDirty();
                }}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-m3-outline bg-m3-surface-container-lowest px-3 py-2.5 font-body text-body-md text-m3-on-surface focus:border-m3-primary focus:outline-none focus:ring-1 focus:ring-m3-primary"
              />
            </div>
          </div>
          <p className="font-body text-body-sm text-m3-on-surface-variant">
            Debe tener al menos 8 caracteres.
          </p>
          {passwordError && (
            <p role="alert" className="flex items-center gap-1 font-body text-body-sm text-m3-error">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {passwordError}
            </p>
          )}
          {passwordOk && (
            <p className="flex items-center gap-1 font-body text-body-sm text-m3-tertiary">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Contraseña actualizada.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="flex items-center gap-2 rounded-lg bg-m3-primary px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity duration-200"
            >
              {savingPassword && (
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              )}
              {savingPassword ? "Cambiando…" : "Cambiar contraseña"}
            </button>
            {isDirty && (
              <button
                type="button"
                onClick={() => {
                  setActual("");
                  setNueva("");
                  setConfirmar("");
                  setIsDirty(false);
                }}
                className="rounded-lg border border-m3-outline-variant px-4 py-2.5 font-label text-label-lg font-semibold text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors duration-200"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
