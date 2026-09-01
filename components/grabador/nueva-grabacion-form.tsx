"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CredencialListItem } from "@/lib/grabador/types";

interface NuevaGrabacionFormProps {
  proyectoId: string;
  credenciales: CredencialListItem[];
}

export function NuevaGrabacionForm({ proyectoId, credenciales }: NuevaGrabacionFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [urlInicial, setUrlInicial] = useState("https://");
  const [ambiente, setAmbiente] = useState<"QA" | "Staging" | "Prod">("QA");
  const [credencialId, setCredencialId] = useState(credenciales[0]?.id ?? "");
  const [navegador] = useState<"chromium">("chromium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      setError("El nombre es requerido");
      return;
    }
    if (!isValidUrl(urlInicial)) {
      setError("URL inválida (debe ser http o https)");
      return;
    }
    if (!credencialId) {
      setError("Selecciona una credencial");
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
            urlInicial,
            ambiente,
            credencialId,
            navegador,
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
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-ink">Nueva grabación</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-ink">
            Nombre de la sesión
          </label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={200}
            placeholder="Ej: Login con credenciales válidas"
            className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink placeholder:text-ink-3 focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
          />
        </div>

        <div>
          <label htmlFor="urlInicial" className="block text-sm font-medium text-ink">
            URL inicial
          </label>
          <input
            id="urlInicial"
            type="url"
            value={urlInicial}
            onChange={(e) => setUrlInicial(e.target.value)}
            required
            placeholder="https://app.example.com/login"
            className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink placeholder:text-ink-3 focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ambiente" className="block text-sm font-medium text-ink">
              Ambiente
            </label>
            <select
              id="ambiente"
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value as typeof ambiente)}
              className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
            >
              <option value="QA">QA</option>
              <option value="Staging">Staging</option>
              <option value="Prod">Prod</option>
            </select>
          </div>

          <div>
            <label htmlFor="credencial" className="block text-sm font-medium text-ink">
              Credencial
            </label>
            <select
              id="credencial"
              value={credencialId}
              onChange={(e) => setCredencialId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
            >
              {credenciales.length === 0 && (
                <option value="">Sin credenciales — crea una primero</option>
              )}
              {credenciales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.vence ? ` (vence ${new Date(c.vence).toLocaleDateString()})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Navegador</label>
          <div className="mt-1 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="navegador" value="chromium" checked readOnly />
              <span>Chromium</span>
            </label>
            <span className="text-xs text-ink-3">(Firefox/WebKit próximamente)</span>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-stamp">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary"
          >
            {pending ? "Iniciando…" : "Iniciar grabación"}
          </button>
        </div>
      </form>
    </div>
  );
}