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
  /** Opcional: el grabador todavía no aplica el storageState al navegador,
   *  así que el login se hace a mano dentro de la ventana grabada. */
  credencialId?: string | null;
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