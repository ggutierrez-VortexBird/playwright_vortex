"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ParentCaseSelect } from "@/components/casos/parent-case-select";
import { encodeDraftQuery, type GrabacionDraft } from "@/lib/grabador/draft";
import type { CredencialListItem } from "@/lib/grabador/types";
import { LOCALE, TIME_ZONE } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";

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
  /** Reemplaza la navegación por defecto a `/casos/grabar/preparar` (uso embebido en modal). */
  onContinue?: (draft: GrabacionDraft) => void;
}

type NavegadorValue = "chromium" | "firefox" | "webkit";

/** Formulario "Nueva grabación": solo junta datos y navega a `/casos/grabar/preparar`, donde se inicia. */
export function NuevaGrabacionForm({ proyectoId, proyectos, credenciales, embedded, onCancel, onContinue }: NuevaGrabacionFormProps) {
  const router = useRouter();
  // Cuando viene `proyectos`, el proyecto se elige dentro del mismo formulario;
  // cuando no, `proyectoId` llega fijo desde el contenedor (p.ej. página de un proyecto).
  const [selectedProyectoId, setSelectedProyectoId] = useState(proyectoId ?? "");
  const [credencialesState, setCredencialesState] = useState<CredencialListItem[]>(credenciales ?? []);
  const [loadingCred, setLoadingCred] = useState(credenciales === undefined && Boolean(proyectoId));
  const [nombre, setNombre] = useState("");
  // URL completa con scheme (permite http://); la validación final la hace `iniciarSesionGrabacion`.
  const [urlInicial, setUrlInicial] = useState("");
  const [ambiente, setAmbiente] = useState<"QA" | "Staging" | "Prod">("QA");
  // El centinela "__none__" es "Login manual" y viaja como "" al enviar; se ofrece siempre porque el grabador aún no aplica el storageState.
  const sentinelNone = "__none__";
  const [credencialId, setCredencialId] = useState<string>(
    credencialesState.length > 0 ? credencialesState[0]!.id : sentinelNone,
  );
  const [navegador, setNavegador] = useState<NavegadorValue>("chromium");
  const [parentCaseId, setParentCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sin credenciales precargadas se piden al elegir proyecto, y se resetean credencial y caso padre.
  const [proyectoAntes, setProyectoAntes] = useState(selectedProyectoId);
  if (proyectoAntes !== selectedProyectoId) {
    setProyectoAntes(selectedProyectoId);
    setParentCaseId(null);
    if (credenciales === undefined) {
      if (!selectedProyectoId) {
        setCredencialesState([]);
        setCredencialId(sentinelNone);
      }
      setLoadingCred(Boolean(selectedProyectoId));
    }
  }

  useEffect(() => {
    if (credenciales !== undefined || !selectedProyectoId) return;
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProyectoId]);

  const tieneCredenciales = credencialesState.length > 0;
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

  const [erroresCampo, setErroresCampo] = useState<{ proyecto?: string; nombre?: string; url?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errores: { proyecto?: string; nombre?: string; url?: string } = {};
    if (proyectos && !selectedProyectoId) errores.proyecto = "Selecciona un proyecto";
    if (!nombre.trim()) errores.nombre = "Escribe un nombre para el caso";
    if (!urlCompleta || !isValidUrl(urlCompleta)) errores.url = "Escribe una URL completa, que empiece por http:// o https://";
    setErroresCampo(errores);
    const primero = (["proyecto", "nombre", "url"] as const).find((k) => errores[k]);
    if (primero) {
      document.getElementById({ proyecto: "grabar-proyecto", nombre: "caso_nombre", url: "url_inicial" }[primero])?.focus();
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
          : "w-full max-w-2xl bg-m3-surface-container-lowest border border-m3-surface-variant rounded-md shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden"
      }
    >
      {!embedded && (
        <header className="bg-m3-surface border-b border-m3-surface-variant px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-headline-lg text-m3-on-surface leading-tight">
              Configuración de Grabación
            </h2>
            <p className="font-body text-body-md text-m3-on-surface-variant mt-1">
              Configure los parámetros iniciales. El navegador de grabación se abre recién en el paso siguiente.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-full bg-m3-secondary-fixed flex items-center justify-center shrink-0"
          >
            <span aria-hidden="true"
              className="material-symbols-outlined text-m3-secondary text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              videocam
            </span>
          </div>
        </header>
      )}

      <div className="p-6 space-y-6">
        {proyectos && (
          <Field label="Proyecto" id="grabar-proyecto" required error={erroresCampo.proyecto}>
            <Select value={selectedProyectoId} onChange={(e) => setSelectedProyectoId(e.target.value)}>
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.espacioNombre}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nombre del caso" id="caso_nombre" required error={erroresCampo.nombre}>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} placeholder="ej. Login exitoso - usuario estándar" />
        </Field>

        <Field label="URL inicial" id="url_inicial" required error={erroresCampo.url} hint="La página donde abre el navegador del grabador.">
          <Input type="url" value={urlInicial} onChange={(e) => setUrlInicial(e.target.value)} placeholder="https://app.ejemplo.com/login" className="font-mono-code text-body-sm" />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Ambiente" id="ambiente">
            <Select value={ambiente} onChange={(e) => setAmbiente(e.target.value as typeof ambiente)}>
              <option value="QA">QA (pruebas)</option>
              <option value="Staging">Staging (preproducción)</option>
              <option value="Prod">Producción</option>
            </Select>
          </Field>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="credencial" className="font-label text-label-md text-m3-on-surface">
              Credencial (sesión iniciada)
            </label>
            <Select
              id="credencial"
              aria-describedby="credencial-ayuda"
              value={credencialId}
              onChange={(e) => setCredencialId(e.target.value)}
              disabled={loadingCred || (!!proyectos && !selectedProyectoId)}
            >
              <option value={sentinelNone}>Ninguna (iniciar sesión a mano)</option>
              {credencialesState.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.vence ? ` (vence ${new Date(c.vence).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE })})` : ""}
                </option>
              ))}
            </Select>
            <p id="credencial-ayuda" className="font-body text-body-xs text-m3-on-surface-variant">
              {proyectos && !selectedProyectoId
                ? "Elige un proyecto para ver sus credenciales."
                : loadingCred
                  ? "Cargando credenciales…"
                  : tieneCredenciales
                    ? "El navegador del grabador abre con esa sesión ya iniciada."
                    : "No hay credenciales para este proyecto. Puedes grabar igual e iniciar sesión dentro de la ventana del grabador."}
            </p>
          </div>

          <div>
            <label
              htmlFor="parentCase"
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
                    className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-m3-secondary ${
                      checked
                        ? "border-m3-secondary bg-m3-secondary-fixed/20"
                        : "border-m3-outline-variant hover:bg-m3-surface-container"
                    }`}
                  >
                    <span aria-hidden="true"
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

        {error && (
          <Alert tone="error"
            data-testid="form-error">{error}</Alert>
        )}
      </div>

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
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </footer>
    </form>
  );
}
