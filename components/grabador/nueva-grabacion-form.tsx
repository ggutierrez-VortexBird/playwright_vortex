"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ParentCaseSelect } from "@/components/casos/parent-case-select";
import { encodeDraftQuery, type GrabacionDraft } from "@/lib/grabador/draft";
import type { CredencialListItem } from "@/lib/grabador/types";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

interface NuevaGrabacionFormProps {
  /** Proyecto fijo (viene ya elegido, p.ej. desde /proyectos/[id]/casos). */
  proyectoId?: string;
  /** Lista de proyectos para elegir dentro del mismo formulario cuando no hay uno fijo. */
  proyectos?: ProyectoOption[];
  /** Credenciales del proyecto fijo. Cuando se provee `proyectos`, se ignoran y se cargan dinámicamente al elegir proyecto. */
  credenciales?: CredencialListItem[];
  /** Cuando es true, omite el header/chrome propios (el contenedor padre ya los provee). */
  embedded?: boolean;
  /** Reemplaza el "Cancelar" -> router.back() por este handler (uso embebido en modal). */
  onCancel?: () => void;
  /**
   * Cuando se provee, reemplaza la navegación por defecto a
   * `/casos/grabar/preparar` (uso embebido en modal, que además necesita
   * cerrarse). El formulario NO arranca la grabación: solo junta los datos.
   * El arranque real ocurre en la pantalla `/casos/grabar/preparar`.
   */
  onContinue?: (draft: GrabacionDraft) => void;
}

type NavegadorValue = "chromium" | "firefox" | "webkit";

/**
 * Form "Nueva Grabación" del HU-G1.
 *
 * Este formulario solo junta los parámetros de la grabación. Al enviar,
 * NO llama a la API ni abre el navegador real — arma un `GrabacionDraft`
 * y navega a `/casos/grabar/preparar`, donde el usuario decide cuándo
 * arrancar (ver ADR: "iniciar grabación vive en su propia pantalla").
 */
export function NuevaGrabacionForm({ proyectoId, proyectos, credenciales, embedded, onCancel, onContinue }: NuevaGrabacionFormProps) {
  const router = useRouter();
  // Cuando viene `proyectos`, el proyecto se elige dentro del mismo formulario;
  // cuando no, `proyectoId` llega fijo desde el contenedor (p.ej. página de un proyecto).
  const [selectedProyectoId, setSelectedProyectoId] = useState(proyectoId ?? "");
  const [credencialesState, setCredencialesState] = useState<CredencialListItem[]>(credenciales ?? []);
  const [loadingCred, setLoadingCred] = useState(false);
  const [nombre, setNombre] = useState("");
  // HU-G34: el usuario tipea la URL completa (con scheme). Antes se preponía
  // `https://` visualmente y solo dejaba editar el host. Con browser headed
  // el usuario necesita poder usar http:// también, y la URL completa se ve
  // en el BrowserChrome de la sesión activa. El `type="url"` del input
  // valida que tenga scheme al perder foco, pero la validación final la
  // hace el server en `iniciarSesionGrabacion`.
  const [urlInicial, setUrlInicial] = useState("");
  const [ambiente, setAmbiente] = useState<"QA" | "Staging" | "Prod">("QA");
  // El centinela "__none__" es "Login manual". Se ofrece SIEMPRE: el
  // grabador todavía no aplica el storageState de la credencial al
  // navegador, así que exigirla solo bloqueaba grabar en proyectos sin
  // credenciales cargadas. Al enviar, el centinela viaja como "".
  const sentinelNone = "__none__";
  const [credencialId, setCredencialId] = useState<string>(
    credencialesState.length > 0 ? credencialesState[0]!.id : sentinelNone,
  );
  const [navegador, setNavegador] = useState<NavegadorValue>("chromium");
  const [parentCaseId, setParentCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cuando el contenedor padre no pre-cargó las credenciales (modal, con o sin
  // selección de proyecto embebida), las cargamos dinámicamente al elegir/tener
  // proyecto, y reseteamos las selecciones que dependían del proyecto anterior
  // (credencial y caso padre). Si `credenciales` viene fijo (página standalone
  // con proyecto fijo), no se vuelve a pedir.
  useEffect(() => {
    if (credenciales !== undefined) return;
    if (!selectedProyectoId) {
      setCredencialesState([]);
      setCredencialId(sentinelNone);
      setParentCaseId(null);
      return;
    }
    let cancelled = false;
    setLoadingCred(true);
    fetch(`/api/proyectos/${selectedProyectoId}/credenciales`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CredencialListItem[]) => {
        if (cancelled) return;
        setCredencialesState(data);
        setCredencialId(data.length > 0 ? data[0]!.id : sentinelNone);
      })
      .catch(() => {
        if (!cancelled) {
          setCredencialesState([]);
          setCredencialId(sentinelNone);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCred(false);
      });
    setParentCaseId(null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProyectoId]);

  const tieneCredenciales = credencialesState.length > 0;
  // HU-G34: los tres navegadores son seleccionables ahora. El worker
  // dispatcha según el valor (chromium/firefox/webkit) en launchSession.
  // const puedeSeleccionarNavegador ya no necesita narrowing — todos son válidos.
  const puedeSeleccionarNavegador = (_v: NavegadorValue) => true;

  const urlCompleta = urlInicial.trim();

  function isValidUrl(s: string): boolean {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (proyectos && !selectedProyectoId) {
      setError("Selecciona un proyecto");
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre del caso es requerido");
      return;
    }
    if (!urlCompleta || !isValidUrl(urlCompleta)) {
      setError("La URL inicial debe ser válida (incluir http:// o https://)");
      return;
    }

    const draft: GrabacionDraft = {
      proyectoId: selectedProyectoId,
      nombre: nombre.trim(),
      urlInicial: urlCompleta,
      ambiente,
      credencialId: credencialId === sentinelNone ? "" : credencialId,
      parentCaseId: parentCaseId ?? "",
      navegador,
    };

    if (onContinue) {
      onContinue(draft);
    } else {
      router.push(`/casos/grabar/preparar?${encodeDraftQuery(draft)}`);
    }
  }

  return (
    <form
      id="nueva-grabacion"
      onSubmit={handleSubmit}
      noValidate
      className={
        embedded
          ? "w-full"
          : "w-full max-w-2xl bg-m3-surface-container-lowest border border-m3-surface-variant rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden"
      }
    >
      {/* Header (omitido en modo embebido: el contenedor padre ya muestra título/volver) */}
      {!embedded && (
        <header className="bg-m3-surface border-b border-m3-surface-variant px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-headline-lg text-m3-primary leading-tight">
              Configuración de Grabación
            </h1>
            <p className="font-body text-body-md text-m3-on-surface-variant mt-1">
              Configure los parámetros iniciales. El navegador de grabación se abre recién en el paso siguiente.
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
      )}

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Proyecto — solo cuando no viene fijo desde el contenedor padre */}
        {proyectos && (
          <div>
            <label
              htmlFor="grabar-proyecto"
              className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
            >
              Proyecto
            </label>
            <select
              id="grabar-proyecto"
              value={selectedProyectoId}
              onChange={(e) => setSelectedProyectoId(e.target.value)}
              required
              className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all appearance-none cursor-pointer"
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.espacioNombre}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* URL Inicial — HU-G34: input libre, el usuario tipea la URL completa
            (incluyendo scheme). La validación del scheme vive en el server
            (`iniciarSesionGrabacion`) y en el BrowserChrome post-start. */}
        <div>
          <label
            htmlFor="url_inicial"
            className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
          >
            URL Inicial
          </label>
          <input
            id="url_inicial"
            type="url"
            value={urlInicial}
            onChange={(e) => setUrlInicial(e.target.value)}
            required
            placeholder="https://app.ejemplo.com/login"
            className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all"
          />
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
              disabled={loadingCred || (!!proyectos && !selectedProyectoId)}
              className="w-full bg-m3-surface-container-lowest border border-m3-outline-variant rounded px-3 py-2 font-body text-body-md text-m3-on-surface focus:outline-none focus:border-m3-secondary focus:ring-1 focus:ring-m3-secondary transition-all appearance-none cursor-pointer disabled:opacity-50"
            >
              {/* "Login manual" siempre disponible: la credencial es
                 opcional porque el grabador todavía no aplica su
                 storageState al navegador. */}
              <option value={sentinelNone}>Ninguna (Login manual)</option>
              {credencialesState.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.vence ? ` (vence ${new Date(c.vence).toLocaleDateString()})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-m3-on-surface-variant">
              {proyectos && !selectedProyectoId
                ? "Elige un proyecto para ver sus credenciales."
                : loadingCred
                  ? "Cargando credenciales…"
                  : tieneCredenciales
                    ? "La credencial queda registrada en la sesión. El login se hace dentro de la ventana del navegador que se abre."
                    : "No hay credenciales para este proyecto. Puedes grabar igual: el login se hace dentro de la ventana del navegador que se abre."}
            </p>
          </div>

          {/* Caso padre (login) */}
          <div>
            <label
              htmlFor="parent-case"
              className="block font-label text-label-sm font-semibold text-m3-primary mb-1.5"
            >
              Caso padre (Login)
            </label>
            <ParentCaseSelect
              proyectoId={selectedProyectoId}
              value={parentCaseId}
              onChange={setParentCaseId}
            />
            <p className="mt-1.5 text-xs text-m3-on-surface-variant">
              Si seleccionas un caso de login, se ejecuta ANTES de abrir el grabador
              y el navegador inicia ya autenticado.
            </p>
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
          onClick={() => (onCancel ? onCancel() : router.back())}
          className="px-4 py-2 rounded text-m3-primary font-label text-label-sm font-semibold hover:bg-m3-surface-container-high transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          data-testid="continuar-grabacion"
          className="px-6 py-2 rounded bg-m3-secondary-container text-m3-on-secondary-container font-label text-label-sm font-bold flex items-center gap-2 hover:bg-m3-secondary hover:text-m3-on-secondary transition-all shadow-sm"
        >
          Continuar
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </footer>
    </form>
  );
}
