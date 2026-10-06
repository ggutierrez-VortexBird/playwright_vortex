import type { RolUsuario } from "@/lib/roles";

export interface EspacioAsignado {
  id: string;
  nombre: string;
}

export interface UsuarioRow {
  id: string;
  email: string;
  nombre: string | null;
  rol: RolUsuario;
  activo: boolean;
  ultimoAccesoAt: string | null;
  createdAt: string;
  espacios: EspacioAsignado[];
}
