"use client";

/**
 * RevisarTabs — HU-G11 MVP.
 *
 * Wrapper con tabs para la pantalla Revisar Caso. Tab 1: "Pasos"
 * (la lista drag-and-drop existente — extraída del RevisarCliente vía
 * children render-prop). Tab 2: "Editor" — Monaco con el .spec.ts
 * generado por el serializer.
 *
 * El componente no toca el guardado del caso (sigue siendo responsabilidad
 * de RevisarCliente en su topbar). Esta capa es de visualización.
 */

import { useState, type ReactNode } from "react";
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
import { CodigoEditor } from "./codigo-editor";
import type {
  RevisarPasoItem,
} from "./revisar-cliente";

export type RevisarTab = "pasos" | "editor";

export interface RevisarTabsProps {
  sesionId: string;
  casoPruebaId: string | null;
  nombre: string;
  pasosIniciales: RevisarPasoItem[];
  parametrosIniciales: import("./revisar-cliente").RevisarParametroItem[];
  /** Script pre-computado (serializado desde el padre, evita duplicar trabajo). */
  scriptGenerado: string;
  /** Opcional: nombre del archivo sugerido. */
  scriptFileName?: string;
  /** Persist reordenamiento (PATCH /pasos). */
  persistOrder?: (newPasos: RevisarPasoItem[]) => Promise<boolean>;
  /** Callback cuando el usuario guarda el script desde la tab Editor. */
  onScriptSaved?: () => void;
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

export function RevisarTabs({
  casoPruebaId,
  pasosIniciales,
  scriptGenerado,
  scriptFileName,
  persistOrder,
  onScriptSaved,
}: RevisarTabsProps) {
  const [tab, setTab] = useState<RevisarTab>("pasos");
  const [pasos, setPasos] = useState<RevisarPasoItem[]>(pasosIniciales);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pasos.findIndex((p) => p.id === active.id);
    const newIndex = pasos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pasos, oldIndex, newIndex);
    setPasos(reordered);
    if (persistOrder) {
      void persistOrder(reordered);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="revisar-tabs">
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Vistas del caso"
        className="flex gap-1 border-b border-gray-200"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pasos"}
          aria-controls="revisar-tab-panel-pasos"
          data-testid="revisar-tab-pasos"
          onClick={() => setTab("pasos")}
          className={
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
            (tab === "pasos"
              ? "border-amber-600 text-amber-700"
              : "border-transparent text-gray-600 hover:text-gray-900")
          }
        >
          Pasos
          <span className="ml-2 text-xs text-gray-500">{pasos.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "editor"}
          aria-controls="revisar-tab-panel-editor"
          data-testid="revisar-tab-editor"
          onClick={() => setTab("editor")}
          className={
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
            (tab === "editor"
              ? "border-amber-600 text-amber-700"
              : "border-transparent text-gray-600 hover:text-gray-900")
          }
        >
          Editor
        </button>
      </div>

      {/* Panel: Pasos */}
      {tab === "pasos" && (
        <div
          id="revisar-tab-panel-pasos"
          role="tabpanel"
          aria-labelledby="revisar-tab-pasos"
          data-testid="revisar-tab-panel-pasos"
        >
          {pasos.length === 0 ? (
            <div className="py-8 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm">
              No hay pasos para revisar.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
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
      )}

      {/* Panel: Editor */}
      {tab === "editor" && (
        <div
          id="revisar-tab-panel-editor"
          role="tabpanel"
          aria-labelledby="revisar-tab-editor"
          data-testid="revisar-tab-panel-editor"
        >
          <CodigoEditor
            scriptInicial={scriptGenerado}
            casoPruebaId={casoPruebaId}
            {...(scriptFileName ? { scriptFileName } : {})}
            {...(onScriptSaved ? { onSaved: onScriptSaved } : {})}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SortablePasoItem — copied from revisar-cliente (kept minimal here)   */
/* ------------------------------------------------------------------ */

function SortablePasoItem({ paso }: { paso: RevisarPasoItem }): ReactNode {
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
      className="flex items-start gap-3 bg-white px-3 py-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <button
        type="button"
        aria-label="Arrastrar para reordenar"
        className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing mt-1"
        {...attributes}
        {...listeners}
        data-testid={`drag-handle-${paso.id}`}
      >
        <span className="material-symbols-outlined text-[18px]">
          drag_indicator
        </span>
      </button>
      <span className="font-mono text-sm text-gray-500 w-7 text-right shrink-0 mt-0.5">
        {paso.numero.toString().padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${badge.color}`}
          >
            {badge.label}
          </span>
          <span className="text-sm text-gray-900 truncate">
            {paso.descripcion}
          </span>
        </div>
        {paso.valor && !paso.esValorSensible && (
          <div className="font-mono text-[11px] text-gray-500 mt-1">
            valor: {paso.valor}
          </div>
        )}
        {paso.esValorSensible && (
          <div className="font-mono text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">lock</span>
            valor sensible (enmascarado)
          </div>
        )}
      </div>
    </li>
  );
}
