// Contrato del job publicado por vortest-web en engine.execute

export interface ExecuteJobMessage {
  /** = Ejecucion.id en vortest-web */
  jobId: string
  /** Texto del script ya listo para escribir a disco (hook y templating inyectados por vortest-web) */
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
