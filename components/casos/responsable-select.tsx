"use client";

import { useState, useEffect } from "react";

interface UsuarioOption {
  id: string;
  email: string;
}

interface ResponsableSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function ResponsableSelect({ value, onChange }: ResponsableSelectProps) {
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsuarios() {
      try {
        const res = await fetch("/api/usuarios");
        if (!res.ok) {
          throw new Error("Error al cargar usuarios");
        }
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      } catch {
        setError("Error al cargar usuarios");
      } finally {
        setLoading(false);
      }
    }

    fetchUsuarios();
  }, []);

  if (loading) {
    return (
      <div className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-sm text-m3-on-surface-variant">
        Cargando usuarios...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-1 block w-full rounded-md border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">
        {error}
      </div>
    );
  }

  return (
    <select
      id="responsable"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="mt-1 block w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 text-m3-on-surface focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary"
    >
      <option value="">Selecciona un responsable</option>
      {usuarios.map((usuario) => (
        <option key={usuario.id} value={usuario.id}>
          {usuario.email}
        </option>
      ))}
    </select>
  );
}
