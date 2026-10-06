/**
 * Borrador de "Nueva grabación" que viaja por query string entre el
 * formulario (`NuevaGrabacionForm`) y la pantalla de arranque
 * (`/casos/grabar/preparar`). La sesión real (fila en BD + navegador
 * headed vía recorder-worker) recién se crea cuando el usuario confirma
 * el arranque en esa pantalla — no al enviar el formulario.
 */
export interface GrabacionDraft {
  proyectoId: string;
  nombre: string;
  urlInicial: string;
  ambiente: "QA" | "Staging" | "Prod";
  /** "" = sin credencial (login manual). */
  credencialId: string;
  /** "" = sin caso padre. */
  parentCaseId: string;
  navegador: "chromium" | "firefox" | "webkit";
}

export function encodeDraftQuery(draft: GrabacionDraft): string {
  const params = new URLSearchParams();
  params.set("proyectoId", draft.proyectoId);
  params.set("nombre", draft.nombre);
  params.set("urlInicial", draft.urlInicial);
  params.set("ambiente", draft.ambiente);
  if (draft.credencialId) params.set("credencialId", draft.credencialId);
  if (draft.parentCaseId) params.set("parentCaseId", draft.parentCaseId);
  params.set("navegador", draft.navegador);
  return params.toString();
}

const VALID_AMBIENTES = ["QA", "Staging", "Prod"] as const;
const VALID_NAVEGADORES = ["chromium", "firefox", "webkit"] as const;

export function decodeDraft(
  sp: Record<string, string | undefined>,
): GrabacionDraft | null {
  if (!sp.proyectoId || !sp.nombre || !sp.urlInicial || !sp.ambiente || !sp.navegador) {
    return null;
  }
  if (!VALID_AMBIENTES.includes(sp.ambiente as (typeof VALID_AMBIENTES)[number])) return null;
  if (!VALID_NAVEGADORES.includes(sp.navegador as (typeof VALID_NAVEGADORES)[number])) return null;

  return {
    proyectoId: sp.proyectoId,
    nombre: sp.nombre,
    urlInicial: sp.urlInicial,
    ambiente: sp.ambiente as GrabacionDraft["ambiente"],
    credencialId: sp.credencialId ?? "",
    parentCaseId: sp.parentCaseId ?? "",
    navegador: sp.navegador as GrabacionDraft["navegador"],
  };
}
