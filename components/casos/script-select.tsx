"use client";

import { useState, useEffect } from "react";

interface ScriptOption {
  path: string;
  name: string;
}

interface ScriptSelectProps {
  proyectoId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ScriptSelect({ proyectoId, value, onChange, disabled }: ScriptSelectProps) {
  const [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proyectoId) {
      setScripts([]);
      setError(null);
      return;
    }

    async function fetchScripts() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/scripts?proyectoId=${encodeURIComponent(proyectoId)}`);
        if (!res.ok) {
          throw new Error("Error al cargar scripts");
        }
        const data = await res.json();
        const items: ScriptOption[] = (data.scripts || []).map((path: string) => ({
          path,
          name: path.split("/").pop() || path,
        }));
        setScripts(items);
      } catch {
        setError("Error al cargar scripts");
      } finally {
        setLoading(false);
      }
    }

    fetchScripts();
  }, [proyectoId]);

  if (disabled || !proyectoId) {
    return (
      <select
        disabled
        className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink-3"
      >
        <option>Selecciona un proyecto primero</option>
      </select>
    );
  }

  if (loading) {
    return (
      <div className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-sm text-ink-3">
        Cargando scripts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-1 block w-full rounded-md border border-stamp bg-red-50 px-3 py-2 text-sm text-stamp">
        {error}
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="mt-1 rounded-md border border-rule bg-background px-3 py-2 text-sm text-ink-3">
        No hay scripts .spec.ts en el directorio del proyecto.
        <br />
        <span className="text-xs">
          Coloca los archivos en: {""}
          <code className="rounded bg-rule px-1 py-0.5 text-ink">
            PLAYWRIGHT_SCRIPTS_ROOT/{proyectoId}/
          </code>
        </span>
      </div>
    );
  }

  return (
    <select
      id="rutaScript"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
    >
      <option value="">Selecciona un script</option>
      {scripts.map((script) => (
        <option key={script.path} value={script.path}>
          {script.name}
        </option>
      ))}
    </select>
  );
}
