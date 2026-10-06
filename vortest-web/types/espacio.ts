export interface Espacio {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EspacioConMetrics extends Espacio {
  proyectoCount: number;
  totalCasos: number;
  tasaExito: number | null;
  ultimaActividad: string | null;
  miembros: { id: string; email: string }[];
}

export interface CreateEspacioInput {
  nombre: string;
  color: string;
}

export interface UpdateEspacioInput {
  nombre?: string;
  color?: string;
}

export interface ApiError {
  error: string;
  message: string;
}
