"use client";

import { useEffect, useState } from "react";
import type { ParentCaseOption } from "@/types/caso";

interface ParentCaseSelectProps {
  proyectoId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  excludeId?: string;
  disabled?: boolean;
}

export function ParentCaseSelect({
  proyectoId,
  value,
  onChange,
  excludeId,
  disabled,
}: ParentCaseSelectProps) {
  const [options, setOptions] = useState<ParentCaseOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!proyectoId) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      parentOptions: "true",
      proyectoId,
      ...(excludeId ? { excludeId } : {}),
    });

    fetch(`/api/casos?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setOptions(data.options ?? []);
        }
      })
      .catch((err) => {
        console.error("[ParentCaseSelect] Error cargando opciones:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [proyectoId, excludeId]);

  return (
    <select
      id="parentCase"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading || options.length === 0}
      className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary disabled:opacity-50"
    >
      <option value="">Ninguno (caso independiente)</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.codigo} — {option.nombre}
        </option>
      ))}
    </select>
  );
}
