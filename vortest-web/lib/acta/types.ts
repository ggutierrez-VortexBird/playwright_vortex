/**
 * Tipos para la generación del acta de evidencia (HU-G19).
 */

export interface ActaTemplatePaso {
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  errorMsg?: string | null
}

export interface ActaTemplateEjecucion {
  id: string
  estado: string
  inicioAt: Date | string | null
  finAt: Date | string | null
  duracionMs: number | null
  errorMsg?: string | null
  entorno: string | null
  navegador: string | null
  sistemaOperativo: string | null
  nodoEjecucion: string | null
  asercionesTotal: number
  asercionesOk: number
  asercionesFail: number
  casoPrueba: {
    nombre: string
    codigo: string
    origen?: string | null
    proyecto: {
      nombre: string
      ambiente: string
      espacio: {
        nombre: string
      }
    }
  }
  pasos: ActaTemplatePaso[]
}

export interface ActaTemplateInput {
  ejecucion: ActaTemplateEjecucion
  actaConsecutivo: string
  generadoEn: Date
}