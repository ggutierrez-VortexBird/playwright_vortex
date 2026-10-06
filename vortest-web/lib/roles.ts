/**
 * Tipos/constantes de rol sin ninguna dependencia de servidor (Prisma,
 * next/headers, iron-session) — a diferencia de `lib/auth.ts`, este módulo
 * es seguro de importar desde componentes cliente.
 */
export type RolUsuario = "superadmin" | "admin" | "tester";

/** Etiqueta legible por rol — único lugar, en vez de duplicarse por pantalla. */
export const ROL_LABEL: Record<RolUsuario, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tester: "Tester",
};
