export interface Espacio {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
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
