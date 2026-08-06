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
      <div className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-sm text-ink-3">
        Cargando usuarios...
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

  return (
    <select
      id="responsable"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="mt-1 block w-full rounded-md border border-rule bg-background px-3 py-2 text-ink focus:border-client focus:outline-none focus:ring-1 focus:ring-client"
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
