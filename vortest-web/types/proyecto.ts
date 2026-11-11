/** Tipos de Proyecto. */

export interface Proyecto {
  id: string;
  espacioId: string;
  nombre: string;
  ambiente: string;
  descripcion: string | null;
  versionSistema: string | null;
  color: string | null;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateProyectoInput {
  nombre: string;
  ambiente: string;
  espacioId: string;
  color?: string | null;
}

export interface UpdateProyectoInput {
  nombre?: string;
  ambiente?: string;
  versionSistema?: string | null;
  descripcion?: string | null;
  color?: string | null;
  activo?: boolean;
}

/** Respuesta de la API para Proyecto con métricas. */
export interface ProyectoWithMetrics {
  id: string;
  espacioId: string;
  nombre: string;
  ambiente: string;
  descripcion: string | null;
  versionSistema: string | null;
  color: string | null;
  activo: boolean;
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

export interface ProyectoWithEspacio extends Proyecto {
  espacio: {
    id: string;
    nombre: string;
    color: string;
    activo: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
}
