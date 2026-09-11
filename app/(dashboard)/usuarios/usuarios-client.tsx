"use client";

import { useState } from "react";

interface UsuarioRow {
  id: string;
  email: string;
  rol: string;
}

interface UsuariosClientProps {
  initialUsuarios: UsuarioRow[];
  puedeElegirRol: boolean;
}

const ROL_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tester: "Tester",
};

export function UsuariosClient({ initialUsuarios, puedeElegirRol }: UsuariosClientProps) {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(initialUsuarios);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "tester">("tester");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rol: puedeElegirRol ? rol : "tester" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No se pudo crear el usuario");
      }
      setUsuarios((prev) => [...prev, data.usuario].sort((a, b) => a.email.localeCompare(b.email)));
      setEmail("");
      setPassword("");
      setRol("tester");
      setSuccessMessage(`"${data.usuario.email}" creado como ${ROL_LABEL[data.usuario.rol]}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {successMessage && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-end sm:flex-wrap"
      >
        <div className="flex flex-1 min-w-[200px] flex-col gap-1">
          <label className="font-label text-label-sm font-semibold text-m3-on-surface-variant">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-m3-outline-variant bg-m3-surface px-3 py-2 text-sm text-m3-on-surface"
            placeholder="nombre@empresa.com"
          />
        </div>
        <div className="flex flex-1 min-w-[200px] flex-col gap-1">
          <label className="font-label text-label-sm font-semibold text-m3-on-surface-variant">Contraseña</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-m3-outline-variant bg-m3-surface px-3 py-2 text-sm text-m3-on-surface"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        {puedeElegirRol && (
          <div className="flex flex-col gap-1">
            <label className="font-label text-label-sm font-semibold text-m3-on-surface-variant">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "admin" | "tester")}
              className="rounded-md border border-m3-outline-variant bg-m3-surface px-3 py-2 text-sm text-m3-on-surface"
            >
              <option value="tester">Tester</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Creando…" : "+ Crear usuario"}
        </button>
      </form>

      {error && (
        <div className="rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-m3-outline-variant text-m3-on-surface-variant">
              <th className="px-5 py-3 font-label text-label-sm">Email</th>
              <th className="px-5 py-3 font-label text-label-sm">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-m3-outline-variant last:border-b-0">
                <td className="px-5 py-3 text-m3-on-surface">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center rounded-full bg-m3-surface-container-high px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
                    {ROL_LABEL[u.rol] ?? u.rol}
                  </span>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-6 text-center text-m3-on-surface-variant">
                  No hay usuarios para mostrar todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
