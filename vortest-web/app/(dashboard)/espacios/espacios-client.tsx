"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { EspaciosForm } from "./espacios-form";
import { AdminsDialog } from "@/components/espacios/admins-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SectionSearch } from "@/components/ui/section-search";
import type { Espacio, EspacioConMetrics } from "@/types/espacio";
import { LOCALE, TIME_ZONE } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

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
  return date.toLocaleDateString(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: TIME_ZONE });
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
    <article className="group flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 hover:scale-[1.01]">
      {/* Cabecera coloreada */}
      <div className="flex flex-col justify-between px-5 pb-5 pt-4 text-white" style={{ backgroundColor: espacio.color }}>
        <div className="flex items-center justify-between gap-2 text-xs text-white/90">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono-code text-label-xs font-medium tracking-wider">
              {codigoEspacio(espacio.id)}
            </span>
            <span className="text-label-xs">{formatRelativo(espacio.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-label-xs font-semibold text-white">
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
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">group</span>
                </button>
                <button
                  onClick={() => onEdit(espacio)}
                  className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  title="Editar"
                  aria-label="Editar espacio"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span>
                </button>
                <button
                  onClick={() => onDelete(espacio)}
                  className="rounded-lg p-1 text-white/80 transition hover:bg-rose-950/40 hover:text-white"
                  title="Eliminar"
                  aria-label="Eliminar espacio"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3">
          <span className="block text-label-xs font-medium uppercase tracking-wider text-white/80">Espacio de trabajo</span>
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
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-label-xs font-bold text-white ring-2 ring-m3-surface-container-lowest ${avatarColor(m.id)}`}
                      title={m.email}
                    >
                      {initialesDeEmail(m.email)}
                    </div>
                  ))}
                  {miembrosOcultos > 0 && (
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-m3-inverse-surface text-label-xs font-medium text-m3-inverse-on-surface ring-2 ring-m3-surface-container-lowest">
                      +{miembrosOcultos}
                    </div>
                  )}
                </div>
                <span className="font-body text-label-xs font-medium text-m3-on-surface-variant">
                  {espacio.miembros.length} admin{espacio.miembros.length !== 1 ? "es" : ""}
                </span>
              </>
            ) : (
              <span className="font-body text-label-xs font-medium text-m3-on-surface-variant">Sin administradores</span>
            )}
          </div>
          <button
            onClick={() => onEnter(espacio.id)}
            style={{ backgroundColor: espacio.color }}
            className="inline-flex items-center justify-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition duration-200 hover:opacity-90"
          >
            Entrar
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">arrow_forward</span>
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
    <div className="flex items-center gap-4 rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3 shadow-card">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: espacio.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-body-md font-semibold text-m3-on-surface">{espacio.nombre}</div>
        <div className="font-mono-code text-label-xs text-m3-on-surface-variant">{codigoEspacio(espacio.id)}</div>
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
          <Button
            variant="ghost"
            size="sm"
            className="bg-m3-surface-container hover:text-m3-primary"
            onClick={() => onManageAdmins(espacio)}
            title="Administradores del espacio"
            aria-label="Administradores del espacio"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">group</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bg-m3-surface-container hover:text-m3-primary"
            onClick={() => onEdit(espacio)}
            title="Editar"
            aria-label="Editar espacio"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bg-m3-surface-container hover:bg-m3-danger-container hover:text-m3-error"
            onClick={() => onDelete(espacio)}
            title="Eliminar"
            aria-label="Eliminar espacio"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span>
          </Button>
        </div>
      )}
      <button
        onClick={() => onEnter(espacio.id)}
        className="shrink-0 rounded-full bg-m3-primary px-4 py-1.5 text-xs font-semibold text-m3-on-primary hover:opacity-90"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">arrow_forward</span>
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
  const [busqueda, setBusqueda] = useState("");

  // Busca por nombre, código (#ESP-XXXX) o email de los administradores —
  // no solo nombre.
  const espaciosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return espacios;
    return espacios.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        codigoEspacio(e.id).toLowerCase().includes(q) ||
        e.miembros.some((m) => m.email.toLowerCase().includes(q))
    );
  }, [espacios, busqueda]);

  const totalPages = Math.max(1, Math.ceil(espaciosFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const espaciosPagina = useMemo(
    () => espaciosFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [espaciosFiltrados, paginaActual]
  );

  function handleViewProyectos(espacioId: string) {
    router.push(`/espacios/${espacioId}/proyectos`);
  }

  if (espacios.length === 0) {
    return (
      <EmptyState
        icon="share"
        title={canEdit ? "Todavía no hay espacios creados." : "No hay espacios asignados a tu cuenta."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-m3-info bg-m3-info-container px-2.5 py-0.5 font-label text-label-sm font-semibold text-m3-info">
          <span className="h-1.5 w-1.5 rounded-full bg-m3-info" />
          {espaciosFiltrados.length} activo{espaciosFiltrados.length !== 1 ? "s" : ""}
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <SectionSearch
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPage(1);
            }}
            placeholder="Buscar espacio…"
          />
          <div className="flex items-center gap-1 rounded-md border border-m3-outline-variant bg-m3-surface-container p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-m3-primary text-white shadow-sm"
                  : "text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high"
              }`}
              title="Vista en cuadrícula"
              aria-label="Vista en cuadrícula"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-m3-primary text-white shadow-sm"
                  : "text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high"
              }`}
              title="Vista en lista"
              aria-label="Vista en lista"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {espaciosFiltrados.length === 0 ? (
        <EmptyState icon="search_off" title={`Sin resultados para "${busqueda}"`} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
          <span className="font-semibold text-m3-on-surface">{espaciosFiltrados.length}</span> espacios
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paginaActual <= 1}
          >
            Anterior
          </Button>
          <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
            {paginaActual}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={paginaActual >= totalPages}
          >
            Siguiente
          </Button>
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
  const [formularioConCambios, setFormularioConCambios] = useState(false);
  const toast = useToast();
  const [deletingEspacio, setDeletingEspacio] = useState<EspacioConMetrics | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreateModal() {
    setShowCreateForm(true);
  }

  function openEditModal(espacio: EspacioConMetrics) {
    setEditingEspacio(espacio);
    setShowCreateForm(false);
  }

  function closeModal() {
    setEditingEspacio(null);
    setShowCreateForm(false);
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
        toast({ tone: "neutral", title: "Espacio eliminado", description: deletingEspacio.nombre });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          tone: "error",
          title: "No se pudo eliminar el espacio",
          description: data.message ?? (res.status === 409 ? "Todavía tiene proyectos o datos asociados." : `El servidor respondió ${res.status}.`),
        });
      }
    } catch {
      toast({ tone: "error", title: "Sin conexión con el servidor", description: "El espacio no se eliminó. Intenta de nuevo." });
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
      toast({ tone: "success", title: "Espacio actualizado", description: updated.nombre });
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
      toast({ tone: "success", title: "Espacio creado", description: updated.nombre });
    }
    closeModal();
  }, [toast]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Espacios de Trabajo"
        description={
          canEdit
            ? "Organiza tu trabajo por cliente o área. Cada espacio tiene un color propio que se propaga a sus proyectos, casos y ejecuciones."
            : "Espacios que administras. Solo el superadmin puede crear, editar o eliminar un espacio."
        }
        badge={{ value: espacios.length, label: espacios.length === 1 ? "espacio" : "espacios" }}
        actions={
          canEdit ? (
            <Button variant="primary" className="inline-flex items-center gap-2" onClick={openCreateModal}>
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
              Nuevo espacio
            </Button>
          ) : undefined
        }
      />

      {/* Modal */}
      {canEdit && (
        <Modal
          open={showCreateForm || !!editingEspacio}
          onClose={closeModal}
          labelledBy="espacios-dialog-title"
          className="max-w-md"
          hayCambios={formularioConCambios}
        >
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="espacios-dialog-title" className="font-headline text-headline-md text-m3-on-surface">
                {editingEspacio ? "Editar espacio" : "Nuevo espacio"}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeModal} aria-label="Cerrar">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
              </Button>
            </div>
            <EspaciosForm
              key={editingEspacio?.id ?? "create"}
              espacio={editingEspacio ?? undefined}
              onSuccess={handleSuccess}
              onCancel={closeModal}
              onCambiosChange={setFormularioConCambios}
            />
          </div>
        </Modal>
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
