"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CredencialListItem } from "@/lib/grabador/types";

interface NuevaGrabacionFormProps {
  proyectoId: string;
  credenciales: CredencialListItem[];
}

type NavegadorValue = "chromium" | "firefox" | "webkit";

/**
 * Form "Nueva Grabación" del HU-G1.
 *
 * Visual fidelity: `fase2/mockups/nuevo-caso-video.html` lines 156-279.
 * Submission: identical to the previous implementation — POST to
 * `/api/grabador/sesiones` (which in turn invokes the Server Action
 * `iniciarSesionGrabacion`). Only the JSX presentation changed.
 */
export function NuevaGrabacionForm({ proyectoId, credenciales }: NuevaGrabacionFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  // Mockup splits the URL field visually: a fixed "https://" prefix and
  // an input where the user types only the host/path. We store the host
  // part here and prepend the scheme on validation/submission.
  const [urlHost, setUrlHost] = useState("");
  const [ambiente, setAmbiente] = useState<"QA" | "Staging" | "Prod">("QA");
  // The "__none__" sentinel means "Login manual" — only offered when no
  // credenciales exist for the project. When credenciales exist the API
  // requires a real credencialId.
  const sentinelNone = "__none__";
  const [credencialId, setCredencialId] = useState<string>(
    credenciales.length > 0 ? credenciales[0]!.id : sentinelNone,
  );
  const [navegador, setNavegador] = useState<NavegadorValue>("chromium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tieneCredenciales = credenciales.length > 0;
  // The mockup offers three browser engines; only chromium is wired in
  // HU-G1 (Firefox/WebKit land in HU-G8). The radios are still visible
  // so the user can preview the future capability, but only chromium
  // is sent to the API.
  const puedeSeleccionarNavegador = (v: NavegadorValue) => v === "chromium";
  const navegadorParaApi: "chromium" = "chromium";

  const urlCompleta = `https://${urlHost.trim()}`;

  function isValidUrl(s: string): boolean {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre del caso es requerido");
      return;
    }
    if (!urlHost.trim() || !isValidUrl(urlCompleta)) {
      setError("La URL inicial debe ser válida (http o https)");
      return;
    }
    if (!tieneCredenciales || credencialId === sentinelNone) {
      setError(
        "Crea al menos una credencial para este proyecto antes de iniciar una grabación",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/grabador/sesiones", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proyectoId,
            nombre: nombre.trim(),
            urlInicial: urlCompleta,
            ambiente,
            credencialId,
            navegador: navegadorParaApi,
          }),
        });

        if (res.status === 201) {
          const data = await res.json();
          router.push(`/casos/grabar/${data.sessionId}`);
        } else {
          const errBody = await res.json().catch(() => ({}));
          setError(errBody.message ?? errBody.error ?? "Error al iniciar");
        }
      } catch {
        setError("Error de conexión");
      }
    });
  }

  return (
    <form
      id="nueva-grabacion"
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-2xl bg-m3-surface-container-lowest border border-m3-surface-variant rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden"
    >
      {/* Header */}
      <header className="bg-m3-surface border-b border-m3-surface-variant px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-headline-lg text-m3-primary leading-tight">
            Configuración de Grabación
          </h1>
          <p className="font-body text-body-md text-m3-on-surface-variant mt-1">
            Configure los parámetros iniciales antes de lanzar el navegador interactivo.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full bg-m3-secondary-fixed flex items-center justify-center shrink-0"
        >
          <span
            className="material-symbols-outlined text-m3-secondary text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            videocam
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Nombre del Caso */}
        <div>
          <label
            htmlFor="caso_nombre"
            className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
          >
            Nombre del Caso
          </label>
          <input
            id="caso_nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={200}
            placeholder="ej. Login Exitoso - Usuario Standard"
            className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all"
          />
        </div>

        {/* URL Inicial */}
        <div>
          <label
            htmlFor="url_inicial"
            className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
          >
            URL Inicial
          </label>
          <div className="flex rounded-md shadow-sm">
            <span
              aria-hidden="true"
              className="inline-flex items-center px-3 rounded-l border border-r-0 border-m3-outline-variant bg-m3-surface-container-low text-m3-on-surface-variant font-mono-code text-mono-code select-none"
            >
              https://
            </span>
            <input
              id="url_inicial"
              type="text"
              inputMode="url"
              value={urlHost}
              onChange={(e) => setUrlHost(e.target.value)}
              required
              placeholder="app.ejemplo.com/login"
              className="flex-1 block w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded-r px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all"
            />
          </div>
        </div>

        {/* Grid 2 cols */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ambiente */}
          <div>
            <label
              htmlFor="ambiente"
              className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
            >
              Ambiente
            </label>
            <select
              id="ambiente"
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value as typeof ambiente)}
              className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all appearance-none cursor-pointer"
            >
              <option value="QA">QA (Testing)</option>
              <option value="Staging">Staging (Pre-prod)</option>
              <option value="Prod">Producción</option>
            </select>
          </div>

          {/* Credencial */}
          <div>
            <label
              htmlFor="credencial"
              className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
            >
              Credencial (Auto-Login)
            </label>
            <select
              id="credencial"
              value={credencialId}
              onChange={(e) => setCredencialId(e.target.value)}
              required
              disabled={!tieneCredenciales}
              className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!tieneCredenciales ? (
                <option value={sentinelNone}>Ninguna (Login manual)</option>
              ) : (
                <>
                  {/* Per mockup spec: when no credenciales exist, the
                     first/only option is "Ninguna (Login manual)".
                     When credenciales exist, we surface them and skip
                     the sentinel because the API requires a real id. */}
                  {credenciales.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.vence ? ` (vence ${new Date(c.vence).toLocaleDateString()})` : ""}
                    </option>
                  ))}
                </>
              )}
            </select>
            {!tieneCredenciales && (
              <p className="mt-1.5 text-xs text-m3-on-surface-variant">
                No hay credenciales para este proyecto. Crea una desde{" "}
                <span className="font-mono-code">/credenciales</span> antes de
                iniciar una grabación.
              </p>
            )}
          </div>
        </div>

        {/* Motor de Navegador — Bento */}
        <div>
          <span className="block font-label text-label-sm font-semibold text-m3-primary mb-2">
            Motor de Navegador
          </span>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { value: "chromium" as const, label: "Chromium", icon: "web" },
                { value: "firefox" as const, label: "Firefox", icon: "language" },
                { value: "webkit" as const, label: "WebKit", icon: "phone_iphone" },
              ]
            ).map((opt) => {
              const checked = navegador === opt.value;
              const enabled = puedeSeleccionarNavegador(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`cursor-pointer relative ${enabled ? "" : "opacity-60"}`}
                  data-testid={`browser-${opt.value}`}
                >
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="browser"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setNavegador(opt.value)}
                    disabled={!enabled}
                  />
                  <div
                    className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                      checked
                        ? "border-m3-secondary bg-m3-secondary-fixed/20"
                        : "border-m3-outline-variant hover:bg-m3-surface-container"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[32px] ${
                        checked ? "text-m3-secondary" : "text-m3-on-surface-variant"
                      }`}
                    >
                      {opt.icon}
                    </span>
                    <span
                      className={`font-label text-label-sm text-center ${
                        checked
                          ? "text-m3-primary font-bold"
                          : "text-m3-on-surface-variant"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {!enabled && (
                      <span className="text-[10px] uppercase tracking-wider text-m3-on-surface-variant">
                        Pronto
                      </span>
                    )}
                  </div>
                  {/* Selected check dot — top-right */}
                  <div
                    aria-hidden="true"
                    className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center ${
                      checked
                        ? "border-m3-secondary bg-m3-secondary"
                        : "border-m3-outline-variant"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full bg-m3-surface-container-lowest ${
                        checked ? "block" : "hidden"
                      }`}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            data-testid="form-error"
            className="rounded-md border border-m3-error-container bg-m3-error-container/40 px-3 py-2 font-body text-body-md text-m3-error"
          >
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-m3-surface-container-low px-6 py-4 flex justify-end gap-3 border-t border-m3-surface-variant">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded text-m3-primary font-label text-label-sm font-semibold hover:bg-m3-surface-container-high transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          data-testid="start-recording"
          className="px-6 py-2 rounded bg-m3-secondary-container text-m3-on-secondary-container font-label text-label-sm font-bold flex items-center gap-2 hover:bg-m3-secondary hover:text-m3-on-secondary transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_arrow
          </span>
          {pending ? "Iniciando…" : "Iniciar Grabador"}
        </button>
      </footer>
    </form>
  );
}
