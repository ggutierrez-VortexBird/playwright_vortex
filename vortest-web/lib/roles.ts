/** Tipos y constantes de rol sin dependencias de servidor; seguro de importar desde componentes cliente. */
export type RolUsuario = "superadmin" | "admin" | "tester";

/** Etiqueta legible por rol — único lugar, en vez de duplicarse por pantalla. */
export const ROL_LABEL: Record<RolUsuario, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tester: "Tester",
};
