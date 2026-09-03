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

/** Cap absoluto para `wait` que persistimos. Cualquier delta mayor
 *  se descarta — Playwright auto-wait ya cubre esos casos.
 *  Coincide con `MAX_WAIT_PERSIST_MS` en codegen/serialize.ts. */
export const MAX_WAIT_PERSIST_MS = 1500;

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

  // FIX BUG DEBOUNCE: agregar `name` al selectorPrincipal.
  // El debounce del fill (doPersistirPaso) usa
  //   key = aria || testId || name || tag
  // para detectar "mismo elemento" entre keystrokes consecutivos.
  // Si `name` no está en el selectorPrincipal persistido, lastSelKey cae
  // al fallback `tag` ("input") mientras newSelKey (de evento.target.name)
  // dice "user-name" — nunca matchean → INSERT en vez de UPDATE → 1 fill
  // por carácter (mismo bug que tenía antes con JSON.stringify).
  const selectorPrincipal = evento.target
    ? {
        tag: evento.target.tag ?? null,
        text: normalize(evento.target.text),
        aria: evento.target.aria ?? null,
        testId: evento.target.testId ?? null,
        name: evento.target.name ?? null,
      }
    : null;

  const selectoresRespaldo = evento.target
    ? (() => {
        // FIX CRITICO: si el init-script del browser manda `candidates`,
        // usarlos DIRECTAMENTE (incluyen role+name, css path, etc).
        // Antes reconstruiamos manualmente solo testid/aria/name/text,
        // perdiendo el candidate `role` que el codegen necesita para
        // emitir `getByRole('searchbox', { name: 'Buscar en Wikipedia' })`.
        if (Array.isArray(evento.target.candidates) && evento.target.candidates.length > 0) {
          return evento.target.candidates.map((c) => ({
            strategy: c.strategy,
            value: c.value,
            ...(c.name ? { name: c.name } : {}),
          }));
        }
        // Fallback legacy: reconstruir manualmente para init-scripts viejos
        // que no envian `candidates`.
        const list: Array<{ strategy: string; value: string; name?: string }> = [];
        if (evento.target?.testId) {
          list.push({ strategy: "testid", value: `[data-testid="${evento.target.testId}"]` });
        }
        // FIX: incluir role en el fallback legacy. Antes se omitía y el codegen
        // caía a getByLabel/getByText. Si hay role + accessibleName (derivado de
        // aria/text/name), emitimos getByRole que es más específico y estable.
        if (evento.target?.role) {
          // FIX ronda 5: NO usar `target.name` (atributo HTML name="x") como
          // proxy para accessible name. El atributo HTML `name` NO es el
          // accessible name. Ej: <button name="login-button">Login</button>
          // tiene accessible name "Login" (del textContent), no "login-button".
          // Usar `target.name` como fallback genera getByRole('button', {
          // name: 'login-button' }) que NUNCA matchea porque el accessible
          // name real es diferente → timeout de 60s.
          const name =
            evento.target.aria?.trim() ||
            evento.target.text?.trim() ||
            "";
          if (name) {
            list.push({ strategy: "role", value: evento.target.role, name });
          } else {
            list.push({ strategy: "role", value: evento.target.role });
          }
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
  // FIX: para waits (auto-wait) el delta viene en `deltaFromPreviousMs`,
  // no en `value`. Sin este fix, el serializer emite siempre
  // `waitForTimeout(1000)` (fallback) porque paso.valor era null.
  let valor: string | null;
  if (esSensible) {
    valor = null;
  } else if (evento.type === "wait") {
    valor = String(evento.deltaFromPreviousMs ?? 0);
  } else {
    valor = evento.value ?? null;
  }

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
 *
 * FIX CRITICO: serializamos todas las llamadas a `persistirPaso` por
 * sesionId via una cola in-memory (mutex por sesion). Esto resuelve el
 * bug donde el usuario tipea rapido (cada letra dispara un __pw_report
 * → handleReportedEvent → persistirPaso concurrente). Sin el mutex, las
 * SELECT max(numero) leen el mismo valor y varios INSERT compiten por
 * el mismo `numero+1` → la mitad falla con P2002 → esos pasos NO se
 * guardan en BD → el script .spec.ts no los tiene.
 *
 * Cada sesion tiene su propia cola, asi que sesiones distintas no se
 * bloquean entre si.
 */

/** Cola de promesas por sesionId — serializa inserts por sesion. */
const sessionLocks = new Map<string, Promise<unknown>>();

export async function persistirPaso(
  evento: EventoDom,
  sesionId: string,
): Promise<PasoGrabadoRow | null> {
  // Skip wait events con delta 0 — son ruido del primer evento de la sesion.
  if (evento.type === "wait" && (evento.deltaFromPreviousMs ?? 0) === 0) {
    return null;
  }

  // Encolar detras de cualquier operacion previa de la misma sesion.
  const previous = sessionLocks.get(sesionId) ?? Promise.resolve();
  const run = previous.then(
    () => doPersistirPaso(evento, sesionId),
    () => doPersistirPaso(evento, sesionId), // corre igual si la anterior fallo
  );
  // Mantener la cadena viva para que las siguientes llamadas esperen.
  sessionLocks.set(
    sesionId,
    run.catch(() => undefined),
  );
  return run;
}

/**
 * Implementacion interna de persistirPaso. Llamada serializada por sesion
 * via el mutex de sessionLocks. Mantiene la logica original de
 * `findFirst → create` con retry en P2002.
 *
 * FIX adicional: deduplica eventos "input" consecutivos sobre el mismo
 * target dentro de un debounce de 1500ms. Esto colapsa el typing per-char
 * en una sola fill final (matchea lo que produce Playwright codegen):
 *   "j" → "ju" → "jul" → ... → "julian alva"  →  11 fills
 *   ↓
 *   "julian alva"  (1 sola fill con el valor final)
 */
async function doPersistirPaso(
  evento: EventoDom,
  sesionId: string,
): Promise<PasoGrabadoRow | null> {
  const FILL_DEBOUNCE_MS = 1500;

  // FIX ronda 4: incluir passwords en el debounce. Antes `!evento.isPassword`
  // excluía passwords → tipear "secret_sauce" generaba 9 filas 'escribir'
  // separadas. Ahora también debounceamos passwords: 1 fila por campo,
  // con valor=null (seguridad) + esValorSensible=true. El codegen emite
  // un solo `fill(params.password)` real.
  if (evento.type === "input") {
    // FIX: usar una "selector key" estable (aria||testId||name||tag)
    // en vez de JSON.stringify del selectorPrincipal completo. El motivo:
    //  1) selectorPrincipal es JSON arbitrario y su forma exacta puede
    //     cambiar entre clientes/browser-versions (keys faltantes, orden
    //     de keys, null vs undefined, etc).
    //  2) el "selector real" que identifica el campo para el debounce es
    //     la combinacion aria|testId|name|tag, en ese orden de prioridad.
    //     Cualquier otro campo (text, bbox, etc) es ruido.
    const newSelKey = evento.target
      ? (
          evento.target.aria?.trim() ||
          evento.target.testId?.trim() ||
          evento.target.name?.trim() ||
          evento.target.tag ||
          ""
        ).toLowerCase()
      : "";

    const lastFill = await prisma.pasoGrabado.findFirst({
      where: {
        sesionId,
        tipo: "escribir",
        createdAt: { gte: new Date(Date.now() - FILL_DEBOUNCE_MS) },
      },
      orderBy: { numero: "desc" },
    });

    if (lastFill && newSelKey) {
      const sp = lastFill.selectorPrincipal as
        | { aria?: string | null; testId?: string | null; name?: string | null; tag?: string | null }
        | null;
      const lastSelKey = sp
        ? (
            sp.aria?.trim() ||
            sp.testId?.trim() ||
            sp.name?.trim() ||
            sp.tag ||
            ""
          ).toLowerCase()
        : "";
      if (lastSelKey === newSelKey) {
        // UPDATE en vez de INSERT.
        const updatedValor = evento.value ?? null;
        const newDescripcion = `Escribir «${updatedValor ?? ""}» en «${
          evento.target?.text || evento.target?.aria || evento.target?.tag || "campo"
        }»`;
        const updated = await prisma.pasoGrabado.update({
          where: { id: lastFill.id },
          data: {
            valor: updatedValor,
            descripcion: newDescripcion,
          },
        });
        return updated as PasoGrabadoRow;
      }
    }
  }

  // Dedupe: si llega un "wait" (auto-wait) y el ULTIMO paso fue tambien
  // un "wait" dentro del debounce, UPDATEamos el delta en vez de crear
  // otro paso. Asi pausas consecutivas (e.g. usuario lee la pagina 1.8s,
  // luego 2.1s) colapsan en UN solo wait con el delta mayor.
  if (evento.type === "wait") {
    const newDelta = evento.deltaFromPreviousMs ?? 0;
    // FIX: cap absoluto en MAX_WAIT_PERSIST_MS (1500). Si llega un wait
    // con delta mayor, NO lo persistimos (return null). Esto evita que
    // el codegen emita waits enormes tipo `waitForTimeout(13000)` que
    // suman 13s al runtime del test sin agregar robustez (Playwright
    // ya tiene auto-wait built-in).
    if (newDelta > MAX_WAIT_PERSIST_MS) {
      return null;
    }
    const lastWait = await prisma.pasoGrabado.findFirst({
      where: {
        sesionId,
        tipo: "esperar",
        createdAt: { gte: new Date(Date.now() - FILL_DEBOUNCE_MS) },
      },
      orderBy: { numero: "desc" },
    });
    if (lastWait) {
      const lastDelta = Number.parseInt(lastWait.valor ?? "0", 10);
      // Si el lastDelta ya era > MAX_WAIT_PERSIST_MS (no debería pasar,
      // pero defense-in-depth), no lo dejamos empeorar.
      if (newDelta > lastDelta) {
        const merged = newDelta;
        const updated = await prisma.pasoGrabado.update({
          where: { id: lastWait.id },
          data: {
            valor: String(merged),
            descripcion: `Esperar ${(merged / 1000).toFixed(1)}s`,
          },
        });
        return updated as PasoGrabadoRow;
      }
      return lastWait as PasoGrabadoRow;
    }
  }

  let attempt = 0;
  const maxAttempts = 5;

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
      const code = (err as { code?: string })?.code;
      if (code === "P2002" && attempt < maxAttempts) {
        // Backoff pequeño (1ms, 2ms, 4ms, ...) para reducir contención.
        await new Promise((r) => setTimeout(r, attempt));
        continue;
      }
      throw err;
    }
  }

  return null;
}

/**
 * Para tests: limpia la cola de mutexes entre tests para que no se
 * contaminen entre sesiones simuladas.
 */
export function _resetSessionLocksForTests(): void {
  sessionLocks.clear();
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
