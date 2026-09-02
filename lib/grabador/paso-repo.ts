/**
 * Persistencia de pasos grabados en la tabla PasoGrabado.
 *
 * Esta capa es responsable de:
 *   1. Mapear un EventoDom → fila PasoGrabado (numero, tipo, origen, descripcion,
 *      selectorPrincipal, selectoresRespaldo, valor, esValorSensible).
 *   2. Garantizar SECURITY (HU-GR-1 partial): si el evento es de tipo password,
 *      NUNCA persistir el valor real — siempre `valor=null, esValorSensible=true`.
 *   3. Garantizar atomicidad del numero de paso por sesion (`max(numero)+1`).
 *
 * Diseño: función pura `mapearEventoAPaso(evento, numero, sesionId)` que
 * construye el payload, más `persistirPaso(evento, sesionId)` que hace el
 * side-effect en Prisma. Las funciones de mapeo se prueban sin tocar DB.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { traducirEvento, PASSWORD_MASK, type EventoDom } from "./translator";

/**
 * Resultado de mapear un evento a un payload Prisma create.
 * Exportado para que los tests unitarios puedan verificar el shape
 * sin tocar la DB.
 */
export interface PasoPayload {
  sesionId: string;
  numero: number;
  tipo: string;
  origen: string;
  descripcion: string;
  selectorPrincipal: unknown;
  selectoresRespaldo: unknown;
  valor: string | null;
  esValorSensible: boolean;
}

/**
 * Construye el payload Prisma `PasoGrabado.create` para un evento.
 *
 * SECURITY: para `isPassword=true` siempre se persiste `valor=null` y
 * `esValorSensible=true`, independientemente del valor que llegue en
 * el evento. La descripcion queda enmascarada vía `traducirEvento`.
 *
 * Selectores: el evento trae un `target` con `tag/text/aria/name/testId`.
 * Como todavía no tenemos el selectorizador robusto (HU-G14 / PR-5), usamos
 * el `text` como selectorPrincipal (lo más legible para debug) y los demás
 * campos como respaldo. Esto se reemplaza cuando llegue el selector real.
 */
export function mapearEventoAPaso(
  evento: EventoDom,
  numero: number,
  sesionId: string,
): PasoPayload {
  const legible = traducirEvento(evento);

  // FIX BULLETPROOF: normalizar el texto en el servidor ANTES de persistir.
  // Esto cubre el caso donde el init-script del browser tiene codigo viejo
  // (porque el recorder-worker no fue reiniciado) y envia text con
  // whitespace crudo (`\n   `) y posible corrupcion de caracteres.
  // Garantiza que la BD SIEMPRE tenga texto normalizado para que el
  // codegen emita `getByText('Usuario')` en vez de `getByText('Usuario\n \n ')`.
  const normalize = (s: string | null | undefined): string | null => {
    if (typeof s !== "string") return null;
    const collapsed = s.replace(/\s+/g, " ").trim();
    return collapsed.length > 0 ? collapsed.slice(0, 50) : null;
  };

  const selectorPrincipal = evento.target
    ? {
        tag: evento.target.tag ?? null,
        text: normalize(evento.target.text),
        aria: evento.target.aria ?? null,
        testId: evento.target.testId ?? null,
      }
    : null;

  const selectoresRespaldo = evento.target
    ? (() => {
        const list: Array<{ strategy: string; value: string }> = [];
        if (evento.target?.testId) {
          list.push({ strategy: "testid", value: `[data-testid="${evento.target.testId}"]` });
        }
        if (evento.target?.aria) {
          list.push({ strategy: "aria-label", value: `[aria-label="${evento.target.aria}"]` });
        }
        if (evento.target?.name) {
          list.push({ strategy: "name", value: `[name="${evento.target.name}"]` });
        }
        if (evento.target?.text) {
          // FIX BULLETPROOF: normalizar tambien el text candidate en el
          // servidor (ver normalize() arriba). Aunque el init-script del
          // browser mande texto crudo, el codegen recibe normalizado.
          list.push({ strategy: "text", value: normalize(evento.target.text) ?? "" });
        }
        return list;
      })()
    : [];

  // SECURITY: nunca persistir el valor real de un password.
  // El init-script del worker ya manda value=null, pero defendemos en depth
  // acá: si isPassword=true, SIEMPRE valor=null, esValorSensible=true.
  const esSensible = Boolean(evento.isPassword);
  const valor = esSensible ? null : (evento.value ?? null);

  return {
    sesionId,
    numero,
    tipo: legible.tipo,
    origen: legible.origen,
    descripcion: legible.descripcion,
    selectorPrincipal,
    selectoresRespaldo,
    valor,
    esValorSensible: esSensible,
  };
}

/**
 * Persiste un paso en DB.
 *
 *   1. Lee `max(numero) + 1` para esa sesion (atomicidad: si dos workers
 *      intentan a la vez, el @@unique([sesionId, numero]) garantiza que
 *      el segundo insert revienta — caller debe reintentar con max+1).
 *   2. Mapea el evento a PasoPayload vía `mapearEventoAPaso`.
 *   3. Inserta la fila.
 *   4. Retorna la fila creada.
 *
 * En caso de colision de unique constraint (P2002), hace UN retry
 * automático (max+1 otra vez). Más allá, propaga el error.
 */
export async function persistirPaso(
  evento: EventoDom,
  sesionId: string,
): Promise<PasoGrabadoRow | null> {
  // Skip wait events con delta 0 — son ruido del primer evento de la sesion.
  if (evento.type === "wait" && (evento.deltaFromPreviousMs ?? 0) === 0) {
    return null;
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;

    const maxRow = await prisma.pasoGrabado.findFirst({
      where: { sesionId },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const nextNumero = (maxRow?.numero ?? 0) + 1;

    const payload = mapearEventoAPaso(evento, nextNumero, sesionId);

    try {
      const created = await prisma.pasoGrabado.create({
        data: {
          sesionId: payload.sesionId,
          numero: payload.numero,
          tipo: payload.tipo,
          origen: payload.origen,
          descripcion: payload.descripcion,
          selectorPrincipal:
            payload.selectorPrincipal === null
              ? Prisma.JsonNull
              : (payload.selectorPrincipal as Prisma.InputJsonValue),
          selectoresRespaldo:
            payload.selectoresRespaldo === null
              ? Prisma.JsonNull
              : (payload.selectoresRespaldo as Prisma.InputJsonValue),
          valor: payload.valor,
          esValorSensible: payload.esValorSensible,
        },
      });
      return created;
    } catch (err: unknown) {
      // Prisma P2002: unique constraint violation. Retry with fresh max+1.
      const code = (err as { code?: string })?.code;
      if (code === "P2002" && attempt < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  // Should be unreachable thanks to the while loop logic.
  return null;
}

/** Shape de la fila PasoGrabado retornada por persistirPaso. */
export interface PasoGrabadoRow {
  id: string;
  sesionId: string;
  numero: number;
  tipo: string;
  origen: string;
  descripcion: string;
  selectorPrincipal: unknown;
  selectoresRespaldo: unknown;
  valor: string | null;
  esValorSensible: boolean;
  createdAt: Date;
}

/** Re-export para tests y consumers que importan desde un solo lugar. */
export { PASSWORD_MASK };
