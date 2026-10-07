"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EstadoBadge } from "@/components/ui/status-badge";
import type { CasoPruebaListItem } from "@/types/caso";
import { formatFecha } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { useLanzarEjecucion } from "@/lib/ejecuciones/use-lanzar-ejecucion";

const PAGE_SIZE = 10;

interface CasoTableProps {
  casos: CasoPruebaListItem[];
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
  canEdit?: boolean;
  /** Muestra la columna Proyecto (el listado general mezcla casos de varios proyectos). */
  mostrarProyecto?: boolean;
}

type Orden = { clave: "codigo" | "nombre" | "proyecto" | "estado" | "fecha"; asc: boolean } | null;

const ORDEN_ESTADO: Record<string, number> = { fallo: 0, errorMotor: 1, paso: 2, "sin ejecuciones": 3 };

function comparar(a: CasoPruebaListItem, b: CasoPruebaListItem, clave: NonNullable<Orden>["clave"]): number {
  switch (clave) {
    case "codigo":
      return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
    case "nombre":
      return a.nombre.localeCompare(b.nombre, "es");
    case "proyecto":
      return a.proyectoNombre.localeCompare(b.proyectoNombre, "es");
    case "estado":
      return (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9);
    case "fecha":
      return (a.fechaUltimaEjecucion ?? "").localeCompare(b.fechaUltimaEjecucion ?? "");
  }
}

const ORIGEN_LABEL: Record<CasoPruebaListItem["origen"], string> = {
  subirScript: "subido",
  grabador: "grabado",
  mixto: "mixto",
};


export function CasoTable({ casos, onEdit, onDelete, canEdit = false, mostrarProyecto = false }: CasoTableProps) {
  const [page, setPage] = useState(1);
  const [orden, setOrden] = useState<Orden>(null);

  const ordenados = useMemo(() => {
    if (!orden) return casos;
    const r = [...casos].sort((a, b) => comparar(a, b, orden.clave));
    return orden.asc ? r : r.reverse();
  }, [casos, orden]);

  const totalPages = Math.max(1, Math.ceil(casos.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const casosPagina = useMemo(
    () => ordenados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [ordenados, paginaActual]
  );

  const columnas: { label: string; clave?: NonNullable<Orden>["clave"] }[] = [
    { label: "Código", clave: "codigo" },
    { label: "Caso", clave: "nombre" },
    ...(mostrarProyecto ? [{ label: "Proyecto", clave: "proyecto" as const }] : []),
    { label: "Responsable" },
    { label: "Estado", clave: "estado" },
    { label: "Última ejecución", clave: "fecha" },
  ];

  function ordenarPor(clave: NonNullable<Orden>["clave"]) {
    setOrden((o) => (o?.clave === clave ? { clave, asc: !o.asc } : { clave, asc: clave !== "fecha" }));
    setPage(1);
  }

  if (casos.length === 0) {
    return <EmptyState icon="fact_check" title="No hay casos de prueba" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      {/* Tabla — md y superior */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="border-b border-m3-outline-variant bg-m3-surface-container">
            <tr>
              {columnas.map((c) => {
                const activa = c.clave !== undefined && orden?.clave === c.clave;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    aria-sort={activa ? (orden!.asc ? "ascending" : "descending") : undefined}
                    className="px-5 py-3 font-label text-label-sm font-semibold text-m3-on-surface-variant"
                  >
                    {c.clave ? (
                      <button
                        type="button"
                        onClick={() => ordenarPor(c.clave!)}
                        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 hover:text-m3-on-surface"
                      >
                        {c.label}
                        <Icon
                          name={activa ? (orden!.asc ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                          size={14}
                          className={activa ? "text-m3-primary" : "opacity-50"}
                        />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
              <th className="px-5 py-3 text-left font-label text-label-sm font-semibold text-m3-on-surface-variant">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant">
            {casosPagina.map((caso) => {
              return (
                <CasoRow
                  key={caso.id}
                  caso={caso}
                  mostrarProyecto={mostrarProyecto}
                  canEdit={canEdit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="flex flex-col divide-y divide-m3-outline-variant md:hidden">
        {casosPagina.map((caso) => {
          return (
            <CasoCard
              key={caso.id}
              caso={caso}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant px-4 py-3 text-xs text-m3-on-surface-variant sm:flex-row">
        <p>
          Mostrando <span className="font-semibold text-m3-on-surface">{casosPagina.length}</span> de{" "}
          <span className="font-semibold text-m3-on-surface">{casos.length}</span> casos registrados
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
    </div>
  );
}

interface CasoRowProps {
  caso: CasoPruebaListItem;
  mostrarProyecto?: boolean;
  canEdit: boolean;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

/** "Ejecutar" compartido entre la fila de tabla y la tarjeta móvil; los errores salen como toast. */
function useEjecutarCaso(caso: CasoPruebaListItem) {
  const { lanzar, lanzando } = useLanzarEjecucion();
  return { running: lanzando, error: null as string | null, handleEjecutar: () => lanzar(caso.id) };
}

interface AccionesCasoProps {
  caso: CasoPruebaListItem;
  canEdit: boolean;
  running: boolean;
  error: string | null;
  onEjecutar: () => void;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

function AccionesCaso({ caso, canEdit, running, error, onEjecutar, onEdit, onDelete }: AccionesCasoProps) {
  return (
    // Un clic en la zona de acciones (incluido un botón deshabilitado) nunca debe abrir la fila.
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        className="hover:text-m3-success"
        onClick={(e) => {
          e.stopPropagation();
          onEjecutar();
        }}
        disabled={running}
        aria-label={`Ejecutar caso ${caso.codigo}`}
        title={running ? "Lanzando…" : "Ejecutar"}
      >
        {running ? (
          <Spinner size={20} label="Lanzando ejecución" />
        ) : (
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">play_arrow</span>
        )}
      </Button>
      {canEdit && (
        <Link
          href={`/casos/${caso.id}?editarScript=1`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Editar script de ${caso.codigo}`}
          title="Editar script"
          data-testid="editar-script-row-action"
          className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-primary"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">code</span>
        </Link>
      )}
      {canEdit && onEdit && (
        <Button
          variant="ghost"
          className="hover:text-m3-primary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(caso);
          }}
          aria-label="Editar"
          title="Editar"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>
        </Button>
      )}
      {canEdit && onDelete && (
        <Button
          variant="ghost"
          className="hover:bg-m3-danger-container hover:text-m3-error"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(caso);
          }}
          aria-label="Eliminar"
          title="Eliminar"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span>
        </Button>
      )}
      {error && <span className="font-label text-label-sm text-m3-error">{error}</span>}
    </div>
  );
}

function CasoRow({ caso, mostrarProyecto, canEdit, onEdit, onDelete }: CasoRowProps) {
  const { running, error, handleEjecutar } = useEjecutarCaso(caso);

  function handleRowClick() {
    if (caso.ultimaEjecucionId) {
      window.location.href = `/ejecuciones/${caso.ultimaEjecucionId}`;
    }
  }

  const hasEjecucion = !!caso.ultimaEjecucionId;

  return (
    <tr
      className={`group hover:bg-m3-surface-container-high${hasEjecucion ? " cursor-pointer" : ""}`}
      onClick={handleRowClick}
    >
      <td className="px-5 py-3">
        <Link
          href={`/casos/${caso.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono-code text-mono-code text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.codigo}
        </Link>
      </td>
      <td className="px-5 py-3">
        <Link
          href={`/casos/${caso.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-body text-body-md font-semibold text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.nombre}
        </Link>
        <div className="font-body text-body-sm text-m3-on-surface-variant">
          {ORIGEN_LABEL[caso.origen]}
        </div>
        {caso.parentCaseCodigo && (
          <div className="mt-1 font-label text-label-sm text-m3-secondary">
            Requiere {caso.parentCaseCodigo}
          </div>
        )}
      </td>
      {mostrarProyecto && (
        <td className="px-5 py-3 font-body text-body-sm">
          <Link href={`/proyectos/${caso.proyectoId}/casos`} onClick={(e) => e.stopPropagation()} className="text-m3-on-surface-variant hover:text-m3-primary hover:underline">
            {caso.proyectoNombre}
          </Link>
        </td>
      )}
      <td className="px-5 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {caso.responsableEmail}
      </td>
      <td className="px-5 py-3">
        <EstadoBadge estado={caso.estado} primerPasoFallido={caso.primerPasoFallidoNumero} />
      </td>
      <td className="px-5 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {formatFecha(caso.fechaUltimaEjecucion, { dia: "numeric" })}
      </td>
      <td className="px-5 py-3">
        <AccionesCaso
          caso={caso}
          canEdit={canEdit}
          running={running}
          error={error}
          onEjecutar={handleEjecutar}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function CasoCard({ caso, canEdit, onEdit, onDelete }: CasoRowProps) {
  const { running, error, handleEjecutar } = useEjecutarCaso(caso);
  const hasEjecucion = !!caso.ultimaEjecucionId;

  function handleCardClick() {
    if (caso.ultimaEjecucionId) {
      window.location.href = `/ejecuciones/${caso.ultimaEjecucionId}`;
    }
  }

  return (
    <div
      className={`flex flex-col gap-2.5 p-4 ${hasEjecucion ? "cursor-pointer active:bg-m3-surface-container-high" : ""}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/casos/${caso.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono-code text-mono-code text-m3-on-surface-variant hover:text-m3-secondary hover:underline"
          >
            {caso.codigo}
          </Link>
          <Link
            href={`/casos/${caso.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-body text-body-md font-semibold text-m3-on-surface hover:text-m3-secondary hover:underline"
          >
            {caso.nombre}
          </Link>
        </div>
        <EstadoBadge estado={caso.estado} primerPasoFallido={caso.primerPasoFallidoNumero} className="shrink-0" />
      </div>

      {caso.parentCaseCodigo && (
        <div className="font-label text-label-sm text-m3-secondary">
          Requiere {caso.parentCaseCodigo}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-body-sm text-m3-on-surface-variant">
        <span>{caso.proyectoNombre}</span>
        <span>·</span>
        <span>{caso.responsableEmail}</span>
        <span>·</span>
        <span>{ORIGEN_LABEL[caso.origen]}</span>
        <span>·</span>
        <span>{formatFecha(caso.fechaUltimaEjecucion, { dia: "numeric" })}</span>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-m3-outline-variant pt-2.5">
        <span className="font-label text-label-sm text-m3-on-surface-variant">Acciones</span>
        <AccionesCaso
          caso={caso}
          canEdit={canEdit}
          running={running}
          error={error}
          onEjecutar={handleEjecutar}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
