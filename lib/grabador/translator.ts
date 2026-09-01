/**
 * Translator: DOM event → PasoLegible (Spanish, human-readable).
 *
 * HU-G3: el recorder-worker captura eventos del browser (`click`, `input`,
 * `change`, `keydown`, `submit`, `navigate`, `wait`) y los traduce a un paso
 * legible que se persiste en la base de datos y se muestra en el panel
 * "PASOS REGISTRADOS" de la UI.
 *
 * SECURITY (HU-GR-1 / C2 password masking): los campos de tipo `password`
 * NUNCA deben persistir ni emitir el valor en claro. Esta función sustituye
 * el valor por `••••••` y marca el paso como sensible aguas arriba
 * (persistirPaso en lib/grabador/paso-repo.ts).
 */

export type TipoPaso = "navegar" | "clic" | "escribir" | "seleccionar" | "esperar" | "verificar" | "generico";
export type OrigenPaso = "grabado" | "auto" | "manual";

export interface SerializedElement {
  tag?: string;
  /** Rol del elemento (role attribute o tagName lowercased). */
  role?: string;
  /** Texto visible del elemento, truncado a 50 chars. */
  text?: string;
  /** Atributo `data-testid`. */
  testId?: string;
  /** aria-label o name o id del elemento. */
  aria?: string;
  /** Valor `name` del input. */
  name?: string;
}

export interface EventoDom {
  type: "click" | "input" | "change" | "keydown" | "submit" | "wait" | "navigate";
  target: SerializedElement | null;
  /** Valor del evento (lo que se escribió, el texto del submit, etc.).
   *  Para passwords SIEMPRE debe llegar como null desde el caller. */
  value: string | null;
  /** Bandera explícita que viene del recorder-worker cuando detecta un
   *  `<input type="password">`. No confiamos solo en target.type para que
   *  sea robusto frente a campos custom. */
  isPassword?: boolean;
  /** Timestamp Unix ms en el que se emitió el evento en el browser. */
  timestamp: number;
  /** Diferencia en ms entre este evento y el anterior (para HU-G4 auto-wait). */
  deltaFromPreviousMs?: number;
  /** URL del navigate (solo para type='navigate'). */
  url?: string;
}

export interface PasoLegible {
  tipo: TipoPaso;
  origen: OrigenPaso;
  /** Texto listo para mostrar al usuario en el panel de pasos. */
  descripcion: string;
}

/** Cuántos caracteres `•` usar para enmascarar credenciales. */
export const PASSWORD_MASK = "••••••";

/**
 * Etiqueta de un elemento serializado, priorizando señales legibles:
 *   1. text (visible)
 *   2. aria-label / name
 *   3. testId
 *   4. tag (fallback)
 *
 * Trunca a 50 chars para mantener legibilidad en el panel.
 */
export function labelDeElemento(target: SerializedElement | null): string {
  if (!target) return "elemento";
  const label =
    target.text?.trim() ||
    target.aria?.trim() ||
    target.name?.trim() ||
    target.testId?.trim() ||
    target.tag?.trim() ||
    "";
  if (!label) return "elemento";
  return label.length > 50 ? `${label.slice(0, 50)}…` : label;
}

/**
 * Traduce un evento DOM a un paso legible en español.
 *
 * El traductor es una función pura: no toca DB, no emite WS, no tiene
 * dependencias externas. Se prueba en aislamiento en
 * `__tests__/lib/grabador/translator.test.ts`.
 */
export function traducirEvento(evento: EventoDom): PasoLegible {
  switch (evento.type) {
    case "navigate": {
      return {
        tipo: "navegar",
        origen: "grabado",
        descripcion: `Abrir «${evento.url ?? ""}»`,
      };
    }

    case "click": {
      const label = labelDeElemento(evento.target);
      return {
        tipo: "clic",
        origen: "grabado",
        descripcion: `Clic en «${label}»`,
      };
    }

    case "submit": {
      return {
        tipo: "clic",
        origen: "grabado",
        descripcion: "Enviar formulario",
      };
    }

    case "input":
    case "change": {
      const fieldLabel = labelDeElemento(evento.target);
      if (evento.isPassword) {
        // SECURITY: nunca persistir el valor real. El caller (paso-repo)
        // usa isPassword para setear valor=null, esValorSensible=true.
        return {
          tipo: "escribir",
          origen: "grabado",
          descripcion: `Escribir «${PASSWORD_MASK}» (credencial) en «${fieldLabel}»`,
        };
      }
      return {
        tipo: "escribir",
        origen: "grabado",
        descripcion: `Escribir «${evento.value ?? ""}» en «${fieldLabel}»`,
      };
    }

    case "wait": {
      // HU-G4: gaps >300ms se persisten como "Esperar X.Xs".
      const deltaMs = evento.deltaFromPreviousMs ?? 0;
      const deltaSec = (deltaMs / 1000).toFixed(1);
      return {
        tipo: "esperar",
        origen: "auto",
        descripcion: `Esperar ${deltaSec}s`,
      };
    }

    case "keydown": {
      // Sin tratamiento especial: el `input` ya captura el resultado final.
      // keydown se persiste como paso "generico" para no inflar el panel.
      const label = labelDeElemento(evento.target);
      return {
        tipo: "generico",
        origen: "grabado",
        descripcion: `Tecla en «${label}»`,
      };
    }

    default: {
      // Exhaustivo — TS bloquea agregar un case sin tocar este default.
      const _exhaustive: never = evento;
      void _exhaustive;
      return {
        tipo: "generico",
        origen: "grabado",
        descripcion: `Evento desconocido`,
      };
    }
  }
}
