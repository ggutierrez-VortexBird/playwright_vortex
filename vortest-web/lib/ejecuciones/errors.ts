// Errores marcadores; sin 'use server' porque Next solo permite exportar async functions desde Server Actions.

export const YA_EXISTE_EJECUCION_EN_CURSO_ERROR = new Error(
  'YA_EXISTE_EJECUCION_EN_CURSO'
)

// La ejecución ya terminó (estado terminal) y no puede detenerse.
export const EJECUCION_YA_TERMINADA_ERROR = new Error(
  'EJECUCION_YA_TERMINADA'
)