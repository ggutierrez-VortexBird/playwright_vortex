/** Tipos del modo grabador, compartidos por actions, recorder-client, route handlers y componentes. */

export type Ambiente = "QA" | "Staging" | "Prod";
// Los 3 navegadores son soportados; el worker despacha según este valor.
export type Navegador = "chromium" | "firefox" | "webkit";

export interface NuevaGrabacionInput {
  proyectoId: string;
  nombre: string;
  urlInicial: string;
  ambiente: Ambiente;
  /** Opcional: credencial con storageState para iniciar el navegador autenticado. */
  credencialId?: string | null;
  /** Caso padre (ej. login) que se ejecuta antes de grabar para obtener un storageState fresco. */
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