"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RevisarTabs } from "./revisar-tabs";
import { ParametrosPanel } from "./parametros-panel";
import {
  serializarPasos,
  type PasoParaSerializar,
  type ParametroParaSerializar,
} from "@/lib/grabador/codegen/serialize";

/**
 * RevisarCliente — pantalla "Revisar caso" (HU-G8 + HU-G11).
 *
 * Server Component `page.tsx` carga la sesion + pasos + parametros
 * desde DB y los pasa como props.
 *
 * Funcionalidad:
 *   - Topbar: título "Revisar caso", estado "borrador sin guardar",
 *     contador N pasos · M parámetros.
 *   - Botones: "Seguir grabando" / "Guardar" / "Guardar y ejecutar"
 *   - Tabs (HU-G11):
 *       1. "Pasos"   — lista drag-and-drop con dnd-kit.
 *       2. "Editor"  — Monaco mostrando el .spec.ts generado.
 *   - Columna derecha: parámetros + acciones.
 *
 * HU-G8 + HU-G10 + HU-G11: el cuerpo principal es <RevisarTabs>.
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
  /** casoPruebaId si la sesión ya fue guardada como CasoPrueba (HU-G11). */
  casoPruebaId?: string | null;
  /** nombre del archivo .spec.ts sugerido (HU-G11). */
  scriptFileName?: string | null;
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
  casoPruebaId = null,
  scriptFileName = null,
}: RevisarClienteProps) {
  const router = useRouter();
  const [pasos, setPasos] = useState<RevisarPasoItem[]>(pasosIniciales);
  const [busy, setBusy] = useState<"guardar" | "ejecutar" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  // HU-G11: pre-computar el script una vez con los pasos actuales.
  // Si el usuario reordena pasos, el script se re-serializa automáticamente
  // porque pasamos `pasos` (state) al serializer.
  const scriptGenerado = serializarPasos(
    pasos.map<PasoParaSerializar>((p) => ({
      id: p.id,
      numero: p.numero,
      tipo: p.tipo,
      descripcion: p.descripcion,
      selectorPrincipal: p.selectorPrincipal,
      selectoresRespaldo: p.selectoresRespaldo,
      valor: p.valor,
      esValorSensible: p.esValorSensible,
      assertionKind: p.assertionKind,
    })),
    {
      nombreDelCaso: nombre,
      parametros: parametrosIniciales.map<ParametroParaSerializar>((p) => ({
        nombre: p.nombre,
        valorDefecto: p.valorDefecto,
      })),
    },
  );

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

      {/* Two-column body (HU-G11: tabs en la columna izquierda) */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: tabs (Pasos / Editor) */}
        <section className="col-span-12 lg:col-span-8">
          <RevisarTabs
            sesionId={sesionId}
            casoPruebaId={casoPruebaId}
            nombre={nombre}
            pasosIniciales={pasos}
            parametrosIniciales={parametrosIniciales}
            scriptGenerado={scriptGenerado}
            {...(scriptFileName ? { scriptFileName } : {})}
            persistOrder={persistOrder}
            onScriptSaved={() => router.refresh()}
          />
        </section>

        {/* Right: parámetros + juego de datos placeholder (HU-G13 lives elsewhere) */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <ParametrosPanel
            parametros={parametrosIniciales}
            readOnly={true}
            emptyMessage="Aún no convertiste ningún valor en parámetro."
          />

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
