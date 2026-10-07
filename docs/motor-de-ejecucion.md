# Motor de ejecución

Cómo se ejecuta un caso de prueba: desde el clic en "Ejecutar" hasta que la evidencia queda guardada. Intervienen tres piezas:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Despacho | `vortest-web` (`lib/ejecuciones/actions.ts`, `dispatch.ts`) | Valida el permiso, crea la ejecución y publica el trabajo. |
| Motor | `vortest-engine` | Corre `playwright test`, informa el progreso y sube la evidencia. No accede a la base de datos. |
| Consumidor | `vortest-web/scripts/execution-consumer.ts` | Guarda en la base lo que informa el motor y encadena casos padre → hijo. |

## 1. Despacho

La interfaz lanza las ejecuciones con `useLanzarEjecucion` → `POST /api/casos/:id/ejecutar` → `dispararEjecucion`:

1. Comprueba que el usuario tenga acceso al proyecto del caso.
2. En una sola transacción toma `pg_advisory_xact_lock` sobre el caso y cuenta sus ejecuciones `pendiente` o `corriendo`. Si hay una, responde `409` con su `ejecucionId`: un caso nunca corre dos veces a la vez.
3. Crea la `Ejecucion`, la pasa a `corriendo`, arma el trabajo con `buildExecuteJob` y lo publica en la cola `engine.execute`. Si RabbitMQ no está disponible, la ejecución queda en `errorMotor` con el motivo.

El trabajo (`ExecuteJobMessage`) lleva todo lo que el motor necesita, ya preparado:

| Campo | Contenido |
|---|---|
| `jobId` | El id de la `Ejecucion`. |
| `scriptText` | El `spec.ts` del caso, con un hook que guarda el `storageState` al terminar. |
| `scriptFileName` | Nombre del archivo a escribir. |
| `navegador` | `chromium`, `firefox` o `webkit`. Obligatorio: es el proyecto de Playwright que se ejecuta. |
| `inputStorageState` | Sesión con la que arranca el navegador: la de una credencial o la que dejó el caso padre. |
| `timeoutMs` | Límite total (`EJECUCION_TIMEOUT_MS`, 10 min por defecto). |

El mensaje viaja envuelto como `{ pattern: "engine.execute", data }`, que es el formato del `ClientProxy` RMQ de NestJS.

## 2. Ejecución en el motor

```
vortest-engine/src/
  queue/execute-job.consumer.ts     recibe trabajos de engine.execute
  queue/events.publisher.ts         publica eventos en engine.events
  execution/execution.service.ts    orquesta un trabajo
  execution/runner.ts               lanza playwright test y lee el reporter
  execution/active-jobs.registry.ts trabajos activos y en espera
  execution/script-writer.ts        escribe el script en disco
  artifacts/artifacts.service.ts    sube la evidencia a la web
  internal-http/                    POST /internal/cancel/:id
  health/                           GET /health
vortest-engine/scripts/my-reporter.js  reporter de Playwright que emite los eventos
```

- **Concurrencia**: cada réplica procesa hasta `ENGINE_MAX_CONCURRENT_JOBS` trabajos a la vez (3 por defecto); el resto espera su turno. Varias réplicas comparten la cola y RabbitMQ reparte los trabajos.
- **Confirmación**: el trabajo se confirma (ack) recién al terminar. La cola es de tipo quorum con `x-delivery-limit: 5`: un trabajo que falla cinco entregas se descarta.
- **Proceso de Playwright**: `playwright test <script> --project <navegador>` con el reporter propio, zona horaria y locale configurables (`PLAYWRIGHT_TIMEZONE`, `PLAYWRIGHT_LOCALE`; por defecto `America/Bogota` y `es-CO`).
- **Aislamiento**: el script recibe una lista blanca de variables de entorno (`PATH`, `HOME`, `TMP`, `LANG`, `TZ`, `PLAYWRIGHT_*`, `PW_*`…). No ve `RABBITMQ_URL` ni `ENGINE_INTERNAL_SECRET`.
- **Datos sensibles**: lo tecleado en campos cuyo nombre sugiere una clave (`password`, `contraseña`, `token`, `pin`, `otp`, `cvv`…) se enmascara en el reporter, antes de llegar a la interfaz o al Acta.

## 3. Eventos de progreso

El reporter escribe una línea por evento con el prefijo `__VORTEST__` (así se distingue de cualquier `console.log` del script). El motor la valida y la publica en `engine.events` como `EngineEvent { jobId, seq, emittedAt, payload }`:

| Evento | Qué informa |
|---|---|
| `env` | Navegador, sistema operativo y nodo donde corre. |
| `step` | Un `test()` del script: descripción, estado (`paso` / `fallo`), duración, error y marcas de tiempo para los capítulos del video. |
| `substep` | Una acción dentro del paso (clic, llenado, navegación, aserción), con su captura si la hay. |
| `log` | Salida de consola. |
| `assertion` | Resultado de una aserción. |
| `captura-test` | Captura tomada al terminar un test. |
| `end` | Resultado final, totales de aserciones, `storageState` resultante y si alguna subida de evidencia falló (`artifactUploadFailed`). |

## 4. Evidencias

Videos, capturas y trazas se suben por HTTP a `POST /api/internal/artefactos/upload` (encabezado `X-Internal-Secret`), con hasta 3 intentos. Cuando un evento menciona una captura, el motor ya la subió y el evento lleva su `artefactoId`, no una ruta de archivo.

La web verifica el SHA-256 y el tamaño mientras escribe el archivo en `/app/storage/artefactos/<ejecucionId>/`, lo nombra con el prefijo del hash (dos `video.webm` del mismo script no se pisan) y deduplica por hash.

## 5. Persistencia

`execution-consumer` lee `engine.events` de a un mensaje por vez y:

- Guarda el entorno, los pasos, las subacciones, los logs y las aserciones a medida que llegan.
- Con `end`, guarda el resultado final **sólo si la ejecución sigue en `corriendo`**: una cancelación nunca queda pisada por un resultado tardío.
- Si un evento falla al guardarse, lo reintenta hasta 5 veces y luego lo descarta con registro, para no bloquear la cola.
- Cada 60 s revisa las ejecuciones `corriendo` que superaron `EJECUCION_TIMEOUT_MS` + 2 min y las marca `errorMotor`.

La pantalla de detalle consulta `GET /api/ejecuciones/:id` cada 2 s mientras la ejecución está en curso (la consulta se pausa con la pestaña oculta) y avisa al terminar.

## 6. Casos encadenados (padre → hijo)

Un caso puede tener un caso padre, típicamente un login, del que hereda la sesión:

1. `dispararEjecucion` crea la ejecución del hijo y otra para el padre, apuntando al hijo (`pendingChildEjecucionId`), y publica sólo el trabajo del padre.
2. Cuando el consumidor recibe el `end` del padre: si fue Conforme, toma su `storageState` y publica el trabajo del hijo con esa sesión; si no, marca al hijo `errorMotor` sin ejecutarlo.
3. El hijo se despacha una sola vez: el consumidor toma `pendingChildEjecucionId` con un compare-and-set antes de publicar.

## 7. Cancelación y límite de tiempo

- **Detener**: `detenerEjecucion` marca la ejecución `cancelado` de inmediato y llama `POST {ENGINE_INTERNAL_URL}/internal/cancel/:ejecucionId`. La réplica que tiene el trabajo lo saca de la espera o mata el árbol de procesos (5 s de gracia); las demás responden `404`, sin efecto.
- **Límite de tiempo**: el motor aplica `timeoutMs` por su cuenta y termina el proceso si se excede.

## Configuración

| Variable | Servicio | Uso |
|---|---|---|
| `RABBITMQ_URL` | web, consumidor, motor | Conexión al broker. |
| `ENGINE_INTERNAL_SECRET` | web, motor | Autentica la subida de evidencias y la cancelación. |
| `ENGINE_INTERNAL_URL` | web | Dirección del motor para cancelar. |
| `MAIN_APP_INTERNAL_URL` | motor | Dirección de la web para subir evidencias. |
| `ENGINE_MAX_CONCURRENT_JOBS` | motor | Trabajos simultáneos por réplica (3). |
| `EJECUCION_TIMEOUT_MS` | web, consumidor | Límite de una ejecución (600 000). |
| `PLAYWRIGHT_TIMEZONE` · `PLAYWRIGHT_LOCALE` | motor | Zona horaria e idioma del navegador de prueba. |
