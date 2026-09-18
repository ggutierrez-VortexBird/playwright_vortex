"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiTile } from "@/components/ui/kpi-tile";
import { SectionSearch } from "@/components/ui/section-search";
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
  // Listen for the "Nuevo usuario" button click dispatched from PageHeader
  useEffect(() => {
    function handleOpenModal() {
      setShowCreateModal(true);
    }
    document.addEventListener("open-create-usuario-modal", handleOpenModal);
    return () => document.removeEventListener("open-create-usuario-modal", handleOpenModal);
  }, []);

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
    const superadmins = usuarios.filter((u) => u.rol === "superadmin").length;
    const admins = usuarios.filter((u) => u.rol === "admin").length;
    const testersActivos = usuarios.filter((u) => u.rol === "tester" && u.activo).length;
    const suspendidos = usuarios.filter((u) => !u.activo).length;
    return { total, superadmins, admins, testersActivos, suspendidos };
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label="Total usuarios"
          value={kpis.total}
          accent="secondary"
          icon="group"
        />
        <KpiTile
          label="Superadmins"
          value={kpis.superadmins}
          accent="secondary"
          icon="shield"
        />
        <KpiTile
          label="Admins"
          value={kpis.admins}
          accent="secondary"
          icon="admin_panel_settings"
        />
        <KpiTile
          label="Testers activos"
          value={kpis.testersActivos}
          accent="success"
          icon="how_to_reg"
        />
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} labelledBy="create-usuario-title" className="max-w-md">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="create-usuario-title" className="font-headline text-headline-md text-m3-primary">
              Nuevo usuario
            </h2>
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateModal(false)} aria-label="Cerrar">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Button>
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
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <div className="flex justify-end">
        <SectionSearch
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPage(1);
          }}
          placeholder="Buscar por email o nombre…"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
        {/* Toolbar: filtros */}
        <div className="flex flex-col gap-4 border-b border-m3-outline-variant p-4">
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                { id: "todos" as const, label: "Todos", count: usuarios.length },
                { id: "superadmin" as const, label: "Superadmins", count: usuarios.filter((u) => u.rol === "superadmin").length },
                { id: "admin" as const, label: "Admins", count: usuarios.filter((u) => u.rol === "admin").length },
                { id: "tester" as const, label: "Testers", count: usuarios.filter((u) => u.rol === "tester").length },
                { id: "suspendidos" as const, label: "Inactivos", count: kpis.suspendidos },
              ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleFiltroChange(tab.id)}
                className={`shrink-0 border-b-2 px-3 py-1.5 font-label text-label-sm font-semibold transition-colors ${
                  filtro === tab.id
                    ? "border-m3-primary text-m3-primary"
                    : "border-transparent text-m3-on-surface-variant hover:border-m3-outline-variant hover:text-m3-on-surface"
                }`}
              >
                {tab.label} <span className="ml-1 text-[11px]">{tab.count}</span>
              </button>
            ))}
            {(busqueda || filtro !== "todos") && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  handleFiltroChange("todos");
                }}
                className="ml-auto shrink-0 font-label text-label-sm text-m3-secondary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tabla (md+) */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-m3-outline-variant bg-m3-surface-container text-m3-on-surface-variant">
                  <th className="px-5 py-3 font-label text-label-sm font-semibold">Usuario</th>
                  <th className="px-5 py-3 font-label text-label-sm font-semibold">Rol</th>
                  <th className="px-5 py-3 font-label text-label-sm font-semibold">Espacios</th>
                  <th className="px-5 py-3 font-label text-label-sm font-semibold">Estado</th>
                  <th className="px-5 py-3 font-label text-label-sm font-semibold">Último acceso</th>
                  <th className="px-5 py-3 text-right font-label text-label-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant">
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
                    <td colSpan={6} className="p-4">
                      <EmptyState icon="group" title="No hay usuarios que coincidan con el filtro." />
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
      </div>

      {/* Tarjetas (móvil) */}
      <div className="flex flex-col gap-3 md:hidden">
        {usuariosPagina.length === 0 ? (
          <EmptyState icon="group" title="No hay usuarios que coincidan con el filtro." />
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

function RolBadge({ rol }: { rol: RolUsuario }) {
  const classes =
    rol === "superadmin"
      ? "bg-m3-secondary-container text-m3-secondary"
      : rol === "admin"
        ? "bg-m3-surface-container-high text-m3-on-surface-variant"
        : "bg-m3-tertiary-container text-m3-tertiary";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-sm font-medium ${classes}`}>
      {ROL_LABEL[rol]}
    </span>
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
  // "Suspendido" usa tone="neutral", no "error" — suspender una cuenta no es
  // un estado de fallo, es simplemente inactividad (paridad con el tono
  // "neutral" que usa StatusBadge para "sin ejecuciones" en caso-table).
  return <StatusBadge tone={activo ? "success" : "neutral"}>{activo ? "Activo" : "Suspendido"}</StatusBadge>;
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
      <Button
        variant="ghost"
        className="hover:text-m3-primary disabled:opacity-30"
        onClick={onEditar}
        disabled={!puedeEditar}
        title={puedeEditar ? "Editar rol y estado" : "No puedes editar este usuario"}
        aria-label="Editar rol y estado"
      >
        <span className="material-symbols-outlined text-[20px]">edit</span>
      </Button>
      {puedeGestionarEspacios && (
        <Button
          variant="ghost"
          className="hover:text-m3-secondary"
          onClick={onGestionarEspacios}
          title="Gestionar espacios asignados"
          aria-label="Gestionar espacios asignados"
        >
          <span className="material-symbols-outlined text-[20px]">share</span>
        </Button>
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
    <tr className={`hover:bg-m3-surface-container-high ${!usuario.activo ? "opacity-60" : ""}`}>
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
        <RolBadge rol={usuario.rol} />
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
    <div className={`rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-card ${!usuario.activo ? "opacity-70" : ""}`}>
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
        <RolBadge rol={usuario.rol} />
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
        <Button variant="secondary" size="sm" onClick={onAnterior} disabled={paginaActual <= 1}>
          Anterior
        </Button>
        <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
          {paginaActual}
        </span>
        <Button variant="secondary" size="sm" onClick={onSiguiente} disabled={paginaActual >= totalPages}>
          Siguiente
        </Button>
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
          <Button variant="ghost" size="sm" type="button" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Button>
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
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="button" onClick={handleGuardar} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
