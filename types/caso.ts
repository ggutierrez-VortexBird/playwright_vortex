/**
 * Types for CasoPrueba entities.
 */

export interface CasoPrueba {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  script: string;
  scriptFileName: string | null;
  responsableId: string;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CasoPruebaFormData {
  codigo: string;
  nombre: string;
  script: string;
  scriptFileName?: string | null;
  responsableId: string;
  proyectoId: string;
  parentCaseId?: string | null;
}

export interface CasoPruebaListItem {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  codigo: string;
  nombre: string;
  scriptFileName: string | null;
  responsableId: string;
  responsableEmail: string;
  parentCaseId: string | null;
  parentCaseCodigo: string | null;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  origen: "subirScript" | "grabador" | "mixto";
  activo: boolean;
  fechaUltimaEjecucion: string | null;
  pasosCount: number | null;
  ultimaEjecucionId: string | null;
  primerPasoFallidoNumero: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ParentCaseOption {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ApiError {
  error: string;
  message: string;
}
