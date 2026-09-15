"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { EspaciosForm } from "./espacios-form";
import { AdminsDialog } from "@/components/espacios/admins-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Espacio, EspacioConMetrics } from "@/types/espacio";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-purple-600",
  "bg-rose-600",
  "bg-teal-600",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialesDeEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const partes = local.split(/[._-]/).filter(Boolean);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function codigoEspacio(id: string): string {
  return `#ESP-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function formatRelativo(dateString: string | Date): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days}d`;
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
}

interface EspacioCardProps {
  espacio: EspacioConMetrics;
  canEdit: boolean;
  onEnter: (espacioId: string) => void;
  onManageAdmins: (espacio: EspacioConMetrics) => void;
  onEdit: (espacio: EspacioConMetrics) => void;
  onDelete: (espacio: EspacioConMetrics) => void;
}

function EspacioCard({ espacio, canEdit, onEnter, onManageAdmins, onEdit, onDelete }: EspacioCardProps) {
  const [hover, setHover] = useState(false);
  const miembrosVisibles = espacio.miembros.slice(0, 3);
  const miembrosOcultos = espacio.miembros.length - miembrosVisibles.length;

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card transition-shadow hover:shadow-md">
      {/* Cabecera coloreada */}
      <div className="flex flex-col justify-between px-5 pb-5 pt-4 text-white" style={{ backgroundColor: espacio.color }}>
        <div className="flex items-center justify-between gap-2 text-xs text-white/90">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono-code text-[11px] font-medium tracking-wider">
              {codigoEspacio(espacio.id)}
            </span>
            <span className="text-[11px]">{formatRelativo(espacio.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Activo
            </span>
            {canEdit && (
              <div className="ml-1 flex items-center gap-0.5">
                <button
                  onClick={() => onManageAdmins(espacio)}
                  className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  title={`${espacio.miembros.length} administrador${espacio.miembros.length !== 1 ? "es" : ""}`}
                  aria-label="Administradores del espacio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </button>
                <button
                  onClick={() => onEdit(espacio)}
                  className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  title="Editar"
                  aria-label="Editar espacio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(espacio)}
                  className="rounded-lg p-1 text-white/80 transition hover:bg-rose-950/40 hover:text-white"
                  title="Eliminar"
                  aria-label="Eliminar espacio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-white/80">Espacio de trabajo</span>
          <h3 className="mt-0.5 truncate text-lg font-bold leading-snug tracking-tight text-white">{espacio.nombre}</h3>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-m3-on-surface-variant">
            <span className="font-medium text-m3-on-surface">
              {espacio.proyectoCount} proyecto{espacio.proyectoCount !== 1 ? "s" : ""}
            </span>
            <span className="text-m3-outline-variant">•</span>
            <span className="font-medium text-m3-on-surface">
              {espacio.totalCasos} caso{espacio.totalCasos !== 1 ? "s" : ""} de prueba
            </span>
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-m3-on-surface-variant">Tasa de éxito</span>
              <span
                className={`font-bold ${
                  espacio.tasaExito === null
                    ? "text-m3-on-surface-variant"
                    : espacio.tasaExito >= 95
                    ? "text-m3-success"
                    : "text-m3-secondary"
                }`}
              >
                {espacio.tasaExito !== null ? `${espacio.tasaExito}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-m3-surface-container">
              <div
                className={`h-full rounded-full ${
                  espacio.tasaExito !== null && espacio.tasaExito < 95 ? "bg-m3-secondary-container" : "bg-m3-success"
                }`}
                style={{ width: `${espacio.tasaExito ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-m3-outline-variant pt-3">
          <div className="flex items-center gap-2">
            {espacio.miembros.length > 0 ? (
              <>
                <div className="flex -space-x-2 overflow-hidden">
                  {miembrosVisibles.map((m) => (
                    <div
                      key={m.id}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-m3-surface-container-lowest ${avatarColor(m.id)}`}
                      title={m.email}
                    >
                      {initialesDeEmail(m.email)}
                    </div>
                  ))}
                  {miembrosOcultos > 0 && (
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-m3-inverse-surface text-[9px] font-medium text-m3-inverse-on-surface ring-2 ring-m3-surface-container-lowest">
                      +{miembrosOcultos}
                    </div>
                  )}
                </div>
                <span className="font-body text-[11px] font-medium text-m3-on-surface-variant">
                  {espacio.miembros.length} admin{espacio.miembros.length !== 1 ? "es" : ""}
                </span>
              </>
            ) : (
              <span className="font-body text-[11px] font-medium text-m3-on-surface-variant">Sin administradores</span>
            )}
          </div>
          <button
            onClick={() => onEnter(espacio.id)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ backgroundColor: hover ? espacio.color : undefined }}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-m3-inverse-surface px-4 py-1.5 text-xs font-semibold text-m3-inverse-on-surface shadow-sm transition duration-200"
          >
            Entrar
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

interface EspacioRowProps {
  espacio: EspacioConMetrics;
  canEdit: boolean;
  onEnter: (espacioId: string) => void;
  onManageAdmins: (espacio: EspacioConMetrics) => void;
  onEdit: (espacio: EspacioConMetrics) => void;
  onDelete: (espacio: EspacioConMetrics) => void;
}

function EspacioRow({ espacio, canEdit, onEnter, onManageAdmins, onEdit, onDelete }: EspacioRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3 shadow-card">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: espacio.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-body-md font-semibold text-m3-on-surface">{espacio.nombre}</div>
        <div className="font-mono-code text-[11px] text-m3-on-surface-variant">{codigoEspacio(espacio.id)}</div>
      </div>
      <div className="hidden shrink-0 items-center gap-4 text-xs text-m3-on-surface-variant sm:flex">
        <span>{espacio.proyectoCount} proyectos</span>
        <span>{espacio.totalCasos} casos</span>
        <span className="font-semibold text-m3-on-surface">
          {espacio.tasaExito !== null ? `${espacio.tasaExito}%` : "—"}
        </span>
        <span>{espacio.miembros.length} admins</span>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onManageAdmins(espacio)}
            className="rounded-lg bg-m3-surface-container p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary"
            title="Administradores del espacio"
            aria-label="Administradores del espacio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(espacio)}
            className="rounded-lg bg-m3-surface-container p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-primary"
            title="Editar"
            aria-label="Editar espacio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(espacio)}
            className="rounded-lg bg-m3-surface-container p-1.5 text-m3-on-surface-variant hover:bg-m3-danger-container hover:text-m3-error"
            title="Eliminar"
            aria-label="Eliminar espacio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      <button
        onClick={() => onEnter(espacio.id)}
        className="shrink-0 rounded-full bg-m3-inverse-surface px-4 py-1.5 text-xs font-semibold text-m3-inverse-on-surface hover:opacity-90"
      >
        Entrar →
      </button>
    </div>
  );
}

const PAGE_SIZE = 9;

interface EspaciosListProps {
  espacios: EspacioConMetrics[];
  onEdit: (espacio: EspacioConMetrics) => void;
  onDelete: (espacio: EspacioConMetrics) => void;
  onAdminsChanged: (espacioId: string, miembros: { id: string; email: string }[]) => void;
  canEdit: boolean;
}

function EspaciosList({ espacios, onEdit, onDelete, onAdminsChanged, canEdit }: EspaciosListProps) {
  const router = useRouter();
  const [manageAdminsFor, setManageAdminsFor] = useState<EspacioConMetrics | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(espacios.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const espaciosPagina = useMemo(
    () => espacios.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [espacios, paginaActual]
  );

  function handleViewProyectos(espacioId: string) {
    router.push(`/espacios/${espacioId}/proyectos`);
  }

  if (espacios.length === 0) {
    return (
      <div className="rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center shadow-card">
        <p className="font-body text-body-md text-m3-on-surface-variant">
          {canEdit ? "Todavía no hay espacios creados." : "No hay espacios asignados a tu cuenta."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-m3-info bg-m3-info-container px-2.5 py-0.5 font-label text-label-sm font-semibold text-m3-info">
          <span className="h-1.5 w-1.5 rounded-full bg-m3-info" />
          {espacios.length} activo{espacios.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1 rounded-xl border border-m3-outline-variant bg-m3-surface-container p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "grid" ? "bg-m3-surface-container-lowest text-m3-on-surface shadow-sm" : "text-m3-on-surface-variant hover:text-m3-on-surface"
            }`}
            title="Vista en cuadrícula"
            aria-label="Vista en cuadrícula"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-lg p-1.5 transition-colors ${
              viewMode === "list" ? "bg-m3-surface-container-lowest text-m3-on-surface shadow-sm" : "text-m3-on-surface-variant hover:text-m3-on-surface"
            }`}
            title="Vista en lista"
            aria-label="Vista en lista"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {espaciosPagina.map((espacio) => (
            <EspacioCard
              key={espacio.id}
              espacio={espacio}
              canEdit={canEdit}
              onEnter={handleViewProyectos}
              onManageAdmins={setManageAdminsFor}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {espaciosPagina.map((espacio) => (
            <EspacioRow
              key={espacio.id}
              espacio={espacio}
              canEdit={canEdit}
              onEnter={handleViewProyectos}
              onManageAdmins={setManageAdminsFor}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-4 pt-1 text-xs text-m3-on-surface-variant sm:flex-row">
        <p>
          Mostrando <span className="font-semibold text-m3-on-surface">{espaciosPagina.length}</span> de{" "}
          <span className="font-semibold text-m3-on-surface">{espacios.length}</span> espacios registrados
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paginaActual <= 1}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
            {paginaActual}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={paginaActual >= totalPages}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {manageAdminsFor && (
        <AdminsDialog
          espacioId={manageAdminsFor.id}
          espacioNombre={manageAdminsFor.nombre}
          onClose={() => setManageAdminsFor(null)}
          onChanged={(admins) =>
            onAdminsChanged(
              manageAdminsFor.id,
              admins.map((a) => ({ id: a.id, email: a.email }))
            )
          }
        />
      )}
    </div>
  );
}

interface EspaciosClientProps {
  initialEspacios: EspacioConMetrics[];
  canEdit: boolean;
}

export function EspaciosClient({ initialEspacios, canEdit }: EspaciosClientProps) {
  const [espacios, setEspacios] = useState<EspacioConMetrics[]>(initialEspacios);
  const [editingEspacio, setEditingEspacio] = useState<EspacioConMetrics | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingEspacio, setDeletingEspacio] = useState<EspacioConMetrics | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openCreateModal() {
    setShowCreateForm(true);
    dialogRef.current?.showModal();
  }

  function openEditModal(espacio: EspacioConMetrics) {
    setEditingEspacio(espacio);
    setShowCreateForm(false);
    dialogRef.current?.showModal();
  }

  function closeModal() {
    setEditingEspacio(null);
    setShowCreateForm(false);
    dialogRef.current?.close();
  }

  function handleDelete(espacio: EspacioConMetrics) {
    setDeletingEspacio(espacio);
  }

  function handleAdminsChanged(espacioId: string, miembros: { id: string; email: string }[]) {
    setEspacios((prev) =>
      prev.map((e) => (e.id === espacioId ? { ...e, miembros } : e))
    );
  }

  async function confirmDelete() {
    if (!deletingEspacio) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/espacios/${deletingEspacio.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setEspacios((prev) => prev.filter((e) => e.id !== deletingEspacio.id));
      }
    } catch (err) {
      console.error("Error deleting espacio:", err);
    } finally {
      setIsDeleting(false);
      setDeletingEspacio(null);
    }
  }

  function handleEdit(espacio: EspacioConMetrics) {
    openEditModal(espacio);
  }

  const handleSuccess = useCallback((updated: Espacio, isEdit: boolean) => {
    if (isEdit) {
      setEspacios((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      setSuccessMessage(`"${updated.nombre}" actualizado exitosamente`);
    } else {
      setEspacios((prev) => [
        {
          ...updated,
          proyectoCount: 0,
          totalCasos: 0,
          tasaExito: null,
          ultimaActividad: null,
          miembros: [],
        },
        ...prev,
      ]);
      setSuccessMessage(`"${updated.nombre}" creado exitosamente`);
    }
    closeModal();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      closeModal();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Success notification */}
      {successMessage && (
        <div className="fixed right-4 top-4 z-50 animate-in slide-in-from-right-2 fade-in duration-300">
          <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 font-label text-label-sm font-semibold text-m3-on-primary shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo espacio
          </button>
        </div>
      )}

      {/* Modal */}
      {canEdit && (
        <dialog
          ref={dialogRef}
          onClick={handleDialogClick}
          className="rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
        >
          <div className="max-h-[85vh] w-[min(90vw,28rem)] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-headline text-headline-md text-m3-primary">
                {editingEspacio ? "Editar espacio" : "Nuevo espacio"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <EspaciosForm
              key={editingEspacio?.id ?? "create"}
              espacio={editingEspacio ?? undefined}
              onSuccess={handleSuccess}
              onCancel={closeModal}
            />
          </div>
        </dialog>
      )}

      <EspaciosList
        espacios={espacios}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdminsChanged={handleAdminsChanged}
        canEdit={canEdit}
      />

      <ConfirmDialog
        open={!!deletingEspacio}
        title="¿Eliminar este espacio?"
        description="Esta acción no se puede deshacer. Se eliminarán también sus proyectos, casos de prueba, ejecuciones y actas asociadas."
        itemLabel={deletingEspacio?.nombre}
        itemColor={deletingEspacio?.color}
        confirmLabel="Eliminar espacio"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingEspacio(null)}
      />
    </div>
  );
}
