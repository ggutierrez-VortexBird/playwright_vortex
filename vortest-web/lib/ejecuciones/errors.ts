// Marker errors para el módulo de ejecuciones.
// Se mantienen en un archivo separado (sin 'use server') porque Next.js no
// permite exportar valores que no sean async functions desde archivos
// marcados como Server Actions.

export const YA_EXISTE_EJECUCION_EN_CURSO_ERROR = new Error(
  'YA_EXISTE_EJECUCION_EN_CURSO'
)

// La ejecución ya terminó (estado terminal: paso, fallo, reparado, errorMotor
// o cancelado) y no puede ser detenida. Análogo a
// YA_EXISTE_EJECUCION_EN_CURSO_ERROR pero para el caso opuesto.
export const EJECUCION_YA_TERMINADA_ERROR = new Error(
  'EJECUCION_YA_TERMINADA'
)