/**
 * Types for Proyecto entities.
 * versionSistema is internal — NOT exposed in API.
 */

export interface Proyecto {
  id: string;
  espacioId: string;
  nombre: string;
  ambiente: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateProyectoInput {
  nombre: string;
  ambiente: string;
  espacioId: string;
}

export interface UpdateProyectoInput {
  nombre?: string;
  ambiente?: string;
}

/**
 * API response type for Proyecto with metrics.
 * Excludes internal fields: versionSistema, descripcion, activo.
 */
export interface ProyectoWithMetrics {
  id: string;
  espacioId: string;
  nombre: string;
  ambiente: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  totalCasos: number;
  casosConformes: number;
  casosNoConformes: number;
  fechaUltimaEjecucion: string | null;
}

export interface ApiError {
  error: string;
  message: string;
}
