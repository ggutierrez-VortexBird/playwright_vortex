/**
 * Types for CasoPrueba entities.
 */

export interface CasoPrueba {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  rutaScript: string;
  responsableId: string;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CasoPruebaFormData {
  codigo: string;
  nombre: string;
  rutaScript: string;
  responsableId: string;
  proyectoId: string;
}

export interface CasoPruebaListItem {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  codigo: string;
  nombre: string;
  rutaScript: string;
  responsableId: string;
  responsableEmail: string;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  activo: boolean;
  fechaUltimaEjecucion: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ApiError {
  error: string;
  message: string;
}
