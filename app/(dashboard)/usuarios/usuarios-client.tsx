"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { UsuarioEspaciosDialog } from "@/components/usuarios/usuario-espacios-dialog";
import { ROL_LABEL, type RolUsuario } from "@/lib/roles";
import type { UsuarioRow } from "@/types/usuario";

interface UsuariosClientProps {
  initialUsuarios: UsuarioRow[];
  puedeElegirRol: boolean;
  actorId: string;
  actorRol: RolUsuario;
}

const PAGE_SIZE = 10;
type Filtro = "todos" | "superadmin" | "admin" | "tester" | "suspendidos";

function formatFecha(iso: string | null): string {
  if (!iso) return "Nunca";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
}

export function UsuariosClient({ initialUsuarios, puedeElegirRol, actorId, actorRol }: UsuariosClientProps) {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(initialUsuarios);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "tester">("tester");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioRow | null>(null);
  const [managingEspaciosFor, setManagingEspaciosFor] = useState<UsuarioRow | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);

  const kpis = useMemo(() => {
    const total = usuarios.length;
    const adminsYSuperadmins = usuarios.filter((u) => u.rol === "admin" || u.rol === "superadmin").length;
    const testersActivos = usuarios.filter((u) => u.rol === "tester" && u.activo).length;
    const suspendidos = usuarios.filter((u) => !u.activo).length;
    return { total, adminsYSuperadmins, testersActivos, suspendidos };
  }, [usuarios]);

  const filtrados = useMemo(() => {
    let lista = usuarios;
    if (filtro === "suspendidos") {
      lista = lista.filter((u) => !u.activo);
    } else if (filtro !== "todos") {
      lista = lista.filter((u) => u.rol === filtro);
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (u) => u.email.toLowerCase().includes(q) || (u.nombre ?? "").toLowerCase().includes(q)
      );
    }
    return lista;
  }, [usuarios, filtro, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const usuariosPagina = useMemo(
    () => filtrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [filtrados, paginaActual]
  );

  function handleFiltroChange(next: Filtro) {
    setFiltro(next);
    setPage(1);
  }

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
      const nuevo: UsuarioRow = {
        id: data.usuario.id,
        email: data.usuario.email,
        nombre: null,
        rol: data.usuario.rol,
        activo: true,
        ultimoAccesoAt: null,
        createdAt: data.usuario.createdAt,
        espacios: [],
      };
      setUsuarios((prev) => [...prev, nuevo].sort((a, b) => a.email.localeCompare(b.email)));
      setEmail("");
      setPassword("");
      setRol("tester");
      setShowCreateModal(false);
      setSuccessMessage(`"${nuevo.email}" creado como ${ROL_LABEL[nuevo.rol]}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setSubmitting(false);
    }
  }

  function handleUsuarioActualizado(actualizado: UsuarioRow) {
    setUsuarios((prev) => prev.map((u) => (u.id === actualizado.id ? { ...u, ...actualizado } : u)));
    setEditingUsuario(null);
  }

  function handleEspaciosActualizados(usuarioId: string, espacios: UsuarioRow["espacios"]) {
    setUsuarios((prev) => prev.map((u) => (u.id === usuarioId ? { ...u, espacios } : u)));
  }

  function puedeEditar(u: UsuarioRow): boolean {
    if (u.id === actorId) return false;
    if (u.rol === "superadmin") return false;
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      {successMessage && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total usuarios" value={kpis.total} />
        <KpiCard label="Admins / Superadmins" value={kpis.adminsYSuperadmins} />
        <KpiCard label="Testers activos" value={kpis.testersActivos} accent="success" />
        <KpiCard label="Usuarios suspendidos" value={kpis.suspendidos} accent={kpis.suspendidos > 0 ? "warn" : undefined} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 font-label text-label-sm font-semibold text-m3-on-primary shadow-sm transition hover:opacity-90 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} labelledBy="create-usuario-title" className="max-w-md">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="create-usuario-title" className="font-headline text-headline-md text-m3-primary">
              Nuevo usuario
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              aria-label="Cerrar"
              className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
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

            {error && (
              <div className="rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">{error}</div>
            )}

            <div className="mt-1 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="font-label text-label-md font-semibold text-m3-on-surface-variant hover:underline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-m3-primary px-5 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Toolbar: filtros + búsqueda */}
      <div className="flex flex-col gap-4 rounded-t-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: "todos" as const, label: "Todos", count: usuarios.length },
              { id: "superadmin" as const, label: "Superadmins", count: usuarios.filter((u) => u.rol === "superadmin").length },
              { id: "admin" as const, label: "Admins", count: usuarios.filter((u) => u.rol === "admin").length },
              { id: "tester" as const, label: "Testers", count: usuarios.filter((u) => u.rol === "tester").length },
              { id: "suspendidos" as const, label: "Suspendidos", count: kpis.suspendidos },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFiltroChange(tab.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 font-label text-label-sm font-semibold transition ${
                filtro === tab.id
                  ? "bg-m3-info-container text-m3-info"
                  : "text-m3-on-surface-variant hover:bg-m3-surface-container-high"
              }`}
            >
              {tab.label} <span className="ml-1 text-[11px]">{tab.count}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por email o nombre…"
          className="w-full rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-2 font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:border-m3-secondary focus:outline-none focus:ring-1 focus:ring-m3-secondary sm:w-80"
        />
      </div>

      {/* Tabla (md+) */}
      <div className="hidden overflow-hidden rounded-b-2xl border-x border-b border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-m3-outline-variant bg-m3-surface-container text-m3-on-surface-variant">
                <th className="px-5 py-3 font-label text-label-sm">Usuario</th>
                <th className="px-5 py-3 font-label text-label-sm">Rol</th>
                <th className="px-5 py-3 font-label text-label-sm">Espacios</th>
                <th className="px-5 py-3 font-label text-label-sm">Estado</th>
                <th className="px-5 py-3 font-label text-label-sm">Último acceso</th>
                <th className="px-5 py-3 text-right font-label text-label-sm">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosPagina.map((u) => (
                <UsuarioTr
                  key={u.id}
                  usuario={u}
                  esYoMismo={u.id === actorId}
                  puedeEditar={puedeEditar(u)}
                  puedeGestionarEspacios={actorRol === "superadmin" && u.rol === "admin"}
                  onEditar={() => setEditingUsuario(u)}
                  onGestionarEspacios={() => setManagingEspaciosFor(u)}
                />
              ))}
              {usuariosPagina.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-m3-on-surface-variant">
                    No hay usuarios que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginacionFooter
          mostrando={usuariosPagina.length}
          total={filtrados.length}
          paginaActual={paginaActual}
          totalPages={totalPages}
          onAnterior={() => setPage((p) => Math.max(1, p - 1))}
          onSiguiente={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>

      {/* Tarjetas (móvil) */}
      <div className="flex flex-col gap-3 md:hidden">
        {usuariosPagina.length === 0 ? (
          <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center font-body text-body-sm text-m3-on-surface-variant shadow-sm">
            No hay usuarios que coincidan con el filtro.
          </div>
        ) : (
          usuariosPagina.map((u) => (
            <UsuarioCard
              key={u.id}
              usuario={u}
              puedeEditar={puedeEditar(u)}
              puedeGestionarEspacios={actorRol === "superadmin" && u.rol === "admin"}
              onEditar={() => setEditingUsuario(u)}
              onGestionarEspacios={() => setManagingEspaciosFor(u)}
            />
          ))
        )}
        <PaginacionFooter
          mostrando={usuariosPagina.length}
          total={filtrados.length}
          paginaActual={paginaActual}
          totalPages={totalPages}
          onAnterior={() => setPage((p) => Math.max(1, p - 1))}
          onSiguiente={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm"
        />
      </div>

      {editingUsuario && (
        <EditUsuarioDialog
          usuario={editingUsuario}
          puedeElegirRol={actorRol === "superadmin"}
          onClose={() => setEditingUsuario(null)}
          onSaved={handleUsuarioActualizado}
        />
      )}

      {managingEspaciosFor && (
        <UsuarioEspaciosDialog
          usuarioId={managingEspaciosFor.id}
          usuarioEmail={managingEspaciosFor.email}
          onClose={() => setManagingEspaciosFor(null)}
          onChanged={(espacios) => handleEspaciosActualizados(managingEspaciosFor.id, espacios)}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warn";
}) {
  const valueClass =
    accent === "success"
      ? "text-m3-success"
      : accent === "warn"
        ? "text-m3-secondary"
        : "text-m3-on-surface";
  return (
    <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm">
      <p className="font-label text-label-sm font-medium uppercase tracking-wider text-m3-on-surface-variant">{label}</p>
      <p className={`mt-1 font-headline text-display ${valueClass}`}>{value}</p>
    </div>
  );
}

function EspaciosCell({ espacios }: { espacios: UsuarioRow["espacios"] }) {
  if (espacios.length === 0) {
    return <span className="font-body text-body-sm text-m3-on-surface-variant">—</span>;
  }
  const [primero, ...resto] = espacios;
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
      {primero!.nombre}
      {resto.length > 0 ? `, ${resto.length} más…` : ""}
    </span>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1.5 font-label text-label-sm font-medium text-m3-success">
      <span className="h-2 w-2 rounded-full bg-m3-success" /> Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-label text-label-sm font-medium text-m3-error">
      <span className="h-2 w-2 rounded-full bg-m3-error" /> Suspendido
    </span>
  );
}

function RowActions({
  puedeEditar,
  puedeGestionarEspacios,
  onEditar,
  onGestionarEspacios,
}: {
  puedeEditar: boolean;
  puedeGestionarEspacios: boolean;
  onEditar: () => void;
  onGestionarEspacios: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={onEditar}
        disabled={!puedeEditar}
        title={puedeEditar ? "Editar rol y estado" : "No puedes editar este usuario"}
        aria-label="Editar rol y estado"
        className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-primary disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </button>
      {puedeGestionarEspacios && (
        <button
          onClick={onGestionarEspacios}
          title="Gestionar espacios asignados"
          aria-label="Gestionar espacios asignados"
          className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function UsuarioTr({
  usuario,
  esYoMismo,
  puedeEditar,
  puedeGestionarEspacios,
  onEditar,
  onGestionarEspacios,
}: {
  usuario: UsuarioRow;
  esYoMismo: boolean;
  puedeEditar: boolean;
  puedeGestionarEspacios: boolean;
  onEditar: () => void;
  onGestionarEspacios: () => void;
}) {
  const iniciales = (usuario.nombre || usuario.email).slice(0, 2).toUpperCase();
  return (
    <tr className={`border-b border-m3-outline-variant last:border-b-0 ${!usuario.activo ? "opacity-60" : ""}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-m3-surface-container-high font-label text-label-sm font-bold text-m3-on-surface-variant">
            {iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate font-body text-body-sm font-semibold text-m3-on-surface">
              {usuario.nombre || usuario.email}
              {esYoMismo && <span className="ml-1.5 rounded bg-m3-info-container px-1.5 py-0.5 text-[10px] font-bold text-m3-info">Tú</span>}
            </p>
            <p className="truncate font-body text-body-sm text-m3-on-surface-variant">{usuario.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className="inline-flex items-center rounded-full bg-m3-surface-container-high px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
          {ROL_LABEL[usuario.rol]}
        </span>
      </td>
      <td className="px-5 py-3">
        <EspaciosCell espacios={usuario.espacios} />
      </td>
      <td className="px-5 py-3">
        <EstadoBadge activo={usuario.activo} />
      </td>
      <td className="px-5 py-3 font-body text-body-sm text-m3-on-surface-variant">{formatFecha(usuario.ultimoAccesoAt)}</td>
      <td className="px-5 py-3 text-right">
        <RowActions
          puedeEditar={puedeEditar}
          puedeGestionarEspacios={puedeGestionarEspacios}
          onEditar={onEditar}
          onGestionarEspacios={onGestionarEspacios}
        />
      </td>
    </tr>
  );
}

function UsuarioCard({
  usuario,
  puedeEditar,
  puedeGestionarEspacios,
  onEditar,
  onGestionarEspacios,
}: {
  usuario: UsuarioRow;
  puedeEditar: boolean;
  puedeGestionarEspacios: boolean;
  onEditar: () => void;
  onGestionarEspacios: () => void;
}) {
  const iniciales = (usuario.nombre || usuario.email).slice(0, 2).toUpperCase();
  return (
    <div className={`rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-4 shadow-sm ${!usuario.activo ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-m3-surface-container-high font-label text-label-sm font-bold text-m3-on-surface-variant">
            {iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate font-body text-body-sm font-semibold text-m3-on-surface">{usuario.nombre || usuario.email}</p>
            <p className="truncate font-body text-body-sm text-m3-on-surface-variant">{usuario.email}</p>
          </div>
        </div>
        <RowActions
          puedeEditar={puedeEditar}
          puedeGestionarEspacios={puedeGestionarEspacios}
          onEditar={onEditar}
          onGestionarEspacios={onGestionarEspacios}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-m3-outline-variant pt-3 text-xs">
        <span className="inline-flex items-center rounded-full bg-m3-surface-container-high px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-surface-variant">
          {ROL_LABEL[usuario.rol]}
        </span>
        <EstadoBadge activo={usuario.activo} />
        <EspaciosCell espacios={usuario.espacios} />
        <span className="font-body text-body-sm text-m3-on-surface-variant">{formatFecha(usuario.ultimoAccesoAt)}</span>
      </div>
    </div>
  );
}

function PaginacionFooter({
  mostrando,
  total,
  paginaActual,
  totalPages,
  onAnterior,
  onSiguiente,
  className,
}: {
  mostrando: number;
  total: number;
  paginaActual: number;
  totalPages: number;
  onAnterior: () => void;
  onSiguiente: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-between gap-4 px-4 py-3 text-xs text-m3-on-surface-variant sm:flex-row ${className ?? "border-t border-m3-outline-variant"}`}>
      <p>
        Mostrando <span className="font-semibold text-m3-on-surface">{mostrando}</span> de{" "}
        <span className="font-semibold text-m3-on-surface">{total}</span> usuarios registrados
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onAnterior}
          disabled={paginaActual <= 1}
          className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
          {paginaActual}
        </span>
        <button
          onClick={onSiguiente}
          disabled={paginaActual >= totalPages}
          className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function EditUsuarioDialog({
  usuario,
  puedeElegirRol,
  onClose,
  onSaved,
}: {
  usuario: UsuarioRow;
  puedeElegirRol: boolean;
  onClose: () => void;
  onSaved: (usuario: UsuarioRow) => void;
}) {
  const [rolSel, setRolSel] = useState<"admin" | "tester">(usuario.rol === "admin" ? "admin" : "tester");
  const [activo, setActivo] = useState(usuario.activo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      const body: { rol?: string; activo: boolean } = { activo };
      if (puedeElegirRol) body.rol = rolSel;
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No se pudo guardar");
      }
      onSaved(data.usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="edit-usuario-title" className="max-w-md">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-usuario-title" className="font-headline text-headline-md text-m3-primary">
            Editar usuario
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <p className="mb-4 font-body text-body-sm text-m3-on-surface-variant">{usuario.email}</p>

        <div className="flex flex-col gap-4">
          {puedeElegirRol ? (
            <div className="flex flex-col gap-1">
              <label className="font-label text-label-sm font-semibold text-m3-on-surface-variant">Rol</label>
              <select
                value={rolSel}
                onChange={(e) => setRolSel(e.target.value as "admin" | "tester")}
                className="rounded-md border border-m3-outline-variant bg-m3-surface px-3 py-2 text-sm text-m3-on-surface"
              >
                <option value="tester">Tester</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ) : (
            <p className="font-body text-body-sm text-m3-on-surface-variant">
              Rol actual: <span className="font-semibold text-m3-on-surface">{ROL_LABEL[usuario.rol]}</span>
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-m3-outline-variant px-3 py-2.5">
            <div>
              <p className="font-label text-label-sm font-semibold text-m3-on-surface">Cuenta activa</p>
              <p className="font-body text-body-sm text-m3-on-surface-variant">
                {activo ? "Puede iniciar sesión normalmente." : "No podrá iniciar sesión hasta reactivarla."}
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} aria-label="Cuenta activa" />
          </div>

          {error && (
            <div className="rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">{error}</div>
          )}

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="font-label text-label-md font-semibold text-m3-on-surface-variant hover:underline"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={saving}
              className="rounded-xl bg-m3-primary px-5 py-2 font-label text-label-md font-semibold text-m3-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
