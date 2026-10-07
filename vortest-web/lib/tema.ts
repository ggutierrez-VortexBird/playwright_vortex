export const CLAVE_TEMA = "vortest-tema";

export type PreferenciaTema = "light" | "dark" | "system";

export function leerPreferenciaTema(): PreferenciaTema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    return guardado === "light" || guardado === "dark" ? guardado : "system";
  } catch {
    return "system";
  }
}

export function aplicarPreferenciaTema(preferencia: PreferenciaTema): void {
  const raiz = document.documentElement;
  if (preferencia === "system") delete raiz.dataset.theme;
  else raiz.dataset.theme = preferencia;
  try {
    if (preferencia === "system") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, preferencia);
  } catch {
    // Sin almacenamiento (modo privado) el tema vale sólo para esta pestaña.
  }
}
