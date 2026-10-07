const colas = new Map<string, Promise<unknown>>();

/** Ejecuta `fn` de a una por clave dentro de este proceso (p. ej. dos "Generar acta" de la misma ejecución). */
export async function conCandado<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = colas.get(clave) ?? Promise.resolve();
  const actual = anterior.catch(() => undefined).then(fn);
  colas.set(clave, actual);
  try {
    return await actual;
  } finally {
    if (colas.get(clave) === actual) colas.delete(clave);
  }
}
