/**
 * Tipos para el modo grabador (HU-G1).
 *
 * Compartidos entre:
 *   - lib/grabador/actions.ts (Server Action orquestadora)
 *   - lib/grabador/recorder-client.ts (cliente HTTP para /internal/start)
 *   - app/api/grabador/* (route handlers)
 *   - components/grabador/* (form + cliente WS)
 */

export type Ambiente = "QA" | "Staging" | "Prod";
// HU-G34: los 3 navegadores son soportados. El worker dispatcha según este valor.
export type Navegador = "chromium" | "firefox" | "webkit";

export interface NuevaGrabacionInput {
  proyectoId: string;
  nombre: string;
  urlInicial: string;
  ambiente: Ambiente;
  /** Opcional: credencial con storageState para iniciar el navegador autenticado. */
  credencialId?: string | null;
  /** Opcional: caso padre (ej. login) que se ejecuta ANTES de iniciar la
   *  grabación para obtener un storageState fresco y arrancar el navegador
   *  ya autenticado. */
  parentCaseId?: string | null;
  navegador: Navegador;
}

export interface SesionGrabacionOut {
  sessionId: string;
  wsUrl: string;
  token: string;
}

export interface SesionEstado {
  id: string;
  estado:
    | "iniciando"
    | "activa"
    | "pausada"
    | "detenida"
    | "descartada"
    | "guardada"
    | "error";
  mensajeError?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface CredencialListItem {
  id: string;
  nombre: string;
  tipo: "storageState" | "cookies" | "userPass";
  vence: string | null;
}