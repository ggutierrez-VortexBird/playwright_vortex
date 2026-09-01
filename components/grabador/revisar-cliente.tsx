"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * RevisarCliente — pantalla "Revisar caso" (HU-G8).
 *
 * Server Component `page.tsx` carga la sesion + pasos + parametros
 * desde DB y los pasa como props.
 *
 * Funcionalidad:
 *   - Topbar: título "Revisar caso", estado "borrador sin guardar",
 *     contador N pasos · M parámetros.
 *   - Botones: "Seguir grabando" / "Guardar" / "Guardar y ejecutar"
 *   - Columna izquierda: lista de pasos drag-and-drop con dnd-kit.
 *   - Columna derecha: parámetros + acciones.
 *
 * HU-G8 + HU-G10: la columna izquierda incluye un botón "Agregar paso"
 * que abre el modal de paso manual.
 */

export interface RevisarPasoItem {
  id: string;
  numero: number;
  tipo: string;
  descripcion: string;
  selectorPrincipal: unknown;
  selectoresRespaldo: unknown;
  valor: string | null;
  esValorSensible: boolean;
  assertionKind: string | null;
}

export interface RevisarParametroItem {
  id: string;
  nombre: string;
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

export interface RevisarClienteProps {
  sesionId: string;
  nombre: string;
  pasosIniciales: RevisarPasoItem[];
  parametrosIniciales: RevisarParametroItem[];
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  navegar: { label: "Abrir", color: "bg-blue-100 text-blue-700" },
  escribir: { label: "Escribir", color: "bg-green-100 text-green-700" },
  clic: { label: "Clic", color: "bg-yellow-100 text-yellow-700" },
  esperar: { label: "Esperar", color: "bg-gray-100 text-gray-700" },
  verificar: { label: "Verificar", color: "bg-purple-100 text-purple-700" },
  seleccionar: { label: "Seleccionar", color: "bg-teal-100 text-teal-700" },
  generico: { label: "Acción", color: "bg-gray-100 text-gray-700" },
};

export function RevisarCliente({
  sesionId,
  nombre,
  pasosIniciales,
  parametrosIniciales,
}: RevisarClienteProps) {
  const router = useRouter();
  const [pasos, setPasos] = useState<RevisarPasoItem[]>(pasosIniciales);
  const [busy, setBusy] = useState<"guardar" | "ejecutar" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = useCallback(
    async (newPasos: RevisarPasoItem[]): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/pasos`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ orderedIds: newPasos.map((p) => p.id) }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setErrorMsg(data.message ?? `Reordenar falló (${res.status})`);
          return false;
        }
        setErrorMsg(null);
        return true;
      } catch {
        setErrorMsg("Error de red al reordenar");
        return false;
      }
    },
    [sesionId],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pasos.findIndex((p) => p.id === active.id);
    const newIndex = pasos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pasos, oldIndex, newIndex);
    // Optimistic update.
    setPasos(reordered);
    void persistOrder(reordered);
  }

  async function handleSeguirGrabando() {
    // HU-G8: reanuda la sesión (estado='activa') y vuelve a /grabar/[sesionId].
    try {
      const res = await fetch(
        `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/reanudar`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setErrorMsg(data.message ?? `Reanudar falló (${res.status})`);
        return;
      }
      router.push(`/casos/grabar/${sesionId}`);
    } catch {
      setErrorMsg("Error de red al reanudar");
    }
  }

  async function handleGuardar(ejecutar: boolean) {
    setBusy(ejecutar ? "ejecutar" : "guardar");
    setErrorMsg(null);
    try {
      const url = `/api/grabador/sesiones/${encodeURIComponent(sesionId)}/guardar${
        ejecutar ? "?ejecutar=true" : ""
      }`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setErrorMsg(data.message ?? `Guardar falló (${res.status})`);
        return;
      }
      const data = (await res.json()) as {
        casoPruebaId: string;
        ejecucionId?: string;
      };
      // Redirect target.
      if (data.ejecucionId) {
        router.push(`/ejecuciones/${data.ejecucionId}`);
      } else {
        router.push(`/casos/${data.casoPruebaId}`);
      }
      startTransition(() => {
        // refresh in background
        router.refresh();
      });
    } catch {
      setErrorMsg("Error de red al guardar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="revisar-cliente">
      {/* Topbar */}
      <div className="bg-m3-surface-container-lowest border border-m3-outline-variant rounded-lg shadow-sm flex flex-col">
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-headline text-headline-lg text-m3-primary font-semibold">
              Revisar caso
            </h2>
            <p className="font-mono-code text-xs text-m3-on-surface-variant mt-1">
              {nombre} · {pasos.length}{" "}
              {pasos.length === 1 ? "paso" : "pasos"} ·{" "}
              {parametrosIniciales.length}{" "}
              {parametrosIniciales.length === 1 ? "parámetro" : "parámetros"} ·
              borrador sin guardar
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSeguirGrabando}
              disabled={busy !== null}
              data-testid="revisar-seguir"
              className="px-4 py-2 border border-m3-outline text-m3-on-surface rounded font-label text-label-sm font-medium hover:bg-m3-surface-container-high transition-colors disabled:opacity-50"
            >
              Seguir grabando
            </button>
            <button
              type="button"
              onClick={() => handleGuardar(false)}
              disabled={busy !== null}
              data-testid="revisar-guardar"
              className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded font-label text-label-sm font-medium hover:bg-m3-secondary-fixed transition-colors disabled:opacity-50 shadow-sm"
            >
              {busy === "guardar" ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => handleGuardar(true)}
              disabled={busy !== null}
              data-testid="revisar-guardar-ejecutar"
              className="px-4 py-2 bg-m3-primary text-m3-on-primary rounded font-label text-label-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {busy === "ejecutar" ? "Ejecutando…" : "Guardar y ejecutar"}
            </button>
          </div>
        </div>
        {errorMsg && (
          <div
            role="alert"
            className="px-5 py-3 border-t border-m3-error/30 bg-m3-error-container/10 text-m3-error font-body text-body-sm"
            data-testid="revisar-error"
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: pasos drag-and-drop */}
        <section className="col-span-12 lg:col-span-8">
          <PasosList
            pasos={pasos}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          />
        </section>

        {/* Right: parámetros */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div
            className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm p-4"
            data-testid="revisar-parametros-section"
          >
            <h3 className="font-headline text-headline-md text-m3-primary tracking-wide mb-2">
              PARÁMETROS
            </h3>
            {parametrosIniciales.length === 0 ? (
              <p className="font-body text-body-sm text-m3-on-surface-variant italic">
                Aún no convertiste ningún valor en parámetro.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {parametrosIniciales.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 text-body-sm"
                  >
                    <span className="font-mono-code bg-m3-tertiary-container text-m3-on-tertiary-container px-1.5 py-0.5 rounded text-xs">
                      {`{{${p.nombre}}}`}
                    </span>
                    <span className="text-m3-on-surface-variant truncate">
                      {p.origen === "credencial" ? "••••" : p.valorDefecto ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm p-4"
            data-testid="revisar-info"
          >
            <h3 className="font-headline text-headline-md text-m3-primary tracking-wide mb-2">
              JUEGO DE DATOS
            </h3>
            <p className="font-body text-body-sm text-m3-on-surface-variant">
              Próximamente: subí un CSV con una fila por escenario para correr
              el caso data-driven.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PasosList — drag-and-drop sortable list                              */
/* ------------------------------------------------------------------ */

function PasosList({
  pasos,
  sensors,
  onDragEnd,
}: {
  pasos: RevisarPasoItem[];
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  return (
    <div
      className="bg-m3-surface-container-lowest rounded-lg border border-m3-outline-variant shadow-sm"
      data-testid="revisar-pasos-section"
    >
      <div className="p-5 border-b border-m3-outline-variant flex justify-between items-center gap-3">
        <h3 className="font-headline text-headline-md text-m3-primary tracking-wide">
          PASOS DEL CASO
        </h3>
        <span className="font-label text-xs text-m3-on-surface-variant">
          Arrastrá para reordenar
        </span>
      </div>
      <div className="p-4">
        {pasos.length === 0 ? (
          <div className="py-8 flex items-center justify-center border-2 border-dashed border-m3-outline-variant/50 rounded-lg text-m3-on-surface-variant">
            <span className="text-sm">No hay pasos para revisar.</span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={pasos.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol
                className="flex flex-col gap-2"
                data-testid="revisar-pasos-list"
              >
                {pasos.map((p) => (
                  <SortablePasoItem key={p.id} paso={p} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortablePasoItem({ paso }: { paso: RevisarPasoItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: paso.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const badge = TYPE_BADGES[paso.tipo] ?? TYPE_BADGES.generico;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`paso-revisar-${paso.id}`}
      className="flex items-start gap-3 bg-m3-surface-container px-3 py-3 rounded-lg border border-m3-outline-variant hover:border-m3-primary/30 transition-colors"
    >
      <button
        type="button"
        aria-label="Arrastrar para reordenar"
        className="text-m3-on-surface-variant hover:text-m3-primary cursor-grab active:cursor-grabbing mt-1"
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${paso.id}`}
      >
        <span className="material-symbols-outlined text-[18px]">
          drag_indicator
        </span>
      </button>
      <span
        className="font-mono-code text-sm text-m3-on-surface-variant w-7 text-right shrink-0 mt-0.5"
        aria-hidden="true"
      >
        {paso.numero.toString().padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-label text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.color}`}
          >
            {badge.label}
          </span>
          <span className="font-body text-body-md text-m3-on-surface truncate">
            {paso.descripcion}
          </span>
        </div>
        {paso.valor && !paso.esValorSensible && (
          <div className="font-mono-code text-[11px] text-m3-on-surface-variant mt-1">
            valor: {paso.valor}
          </div>
        )}
        {paso.esValorSensible && (
          <div className="font-mono-code text-[11px] text-m3-on-surface-variant mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">lock</span>
            valor sensible (enmascarado)
          </div>
        )}
      </div>
    </li>
  );
}
