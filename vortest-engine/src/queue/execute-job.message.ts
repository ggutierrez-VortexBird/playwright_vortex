// src/queue/execute-job.message.ts
// Contrato del trabajo publicado por vortest-web a la cola `engine.execute`.
// Exacto, tal como está definido en
// documentacion/arquitectura-motor-execution-microservicio.md.

export interface ExecuteJobMessage {
  /** = Ejecucion.id en vortest-web */
  jobId: string
  /**
   * caso.script YA con el hook afterEach de storageState y el templating de
   * auto-reparación inyectados por vortest-web. El motor no sabe qué es un
   * "caso" — solo recibe texto de script listo para escribir a disco.
   */
  scriptText: string
  scriptFileName: string
  /** storageState del caso padre, si aplica (encadenamiento padre/hijo). */
  inputStorageState?: unknown
  /** Configurable por env en vortest-web; el motor ya no hardcodea 10 min. */
  timeoutMs: number
  publishedAt: string
  /** Navegador a usar para la ejecución. */
  navegador?: 'chromium' | 'firefox' | 'webkit'
}
