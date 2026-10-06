# HU-3 — Spec: Motor de ejecución Playwright

## Historia

Como **usuario superadministrador**
Quiero que la plataforma dispare, ejecute, controle y muestre en vivo cada caso de prueba Playwright
cuyo script está guardado en la BD como texto
Para correr las pruebas reales, evitar conflictos, distinguir fallas del motor de fallas de la prueba,
y ver el progreso real mientras la prueba corre.

**Fuente de verdad**: los 11 criterios de aceptación (ACs) documentados en el proposal de HU-3.
**Modelo de datos**: `Ejecucion` con estados `pendiente | corriendo | paso | fallo | reparado | errorMotor`;
`PasoEjecucion` con estados `paso | fallo | reparado`.
**Script almacenado como texto** en `CasoPrueba.script` (no como ruta de archivo).
**Worker**: script Node.js standalone en `scripts/playwright-worker.ts` que polling-ea la BD cada 5 segundos.
**Streaming**: polling HTTP del cliente cada 2s contra `GET /api/ejecuciones/[id]`.
**Lock concurrencia**: `SELECT FOR UPDATE NOWAIT` en transacción Prisma.
**Reporter**: script `scripts/playwright-reporter.js` que emite JSON por stdout línea a línea.
**Validación lazy**: intentar ejecutar; si falla parse o archivo no existe → `errorMotor`.

---

## Escenario: Disparar una ejecución de caso de prueba — AC-1

**HU-3.1 / AC-1**

Dado que existe un caso de prueba registrado en el sistema con `script` no vacío en la BD
Y el caso no tiene ninguna ejecución en estado `"pendiente"` ni `"corriendo"`
Cuando presiono el botón "Ejecutar" en la fila del caso (o en su vista de detalle)
Entonces el sistema crea una nueva fila en `Ejecucion` con `estado = "pendiente"`
Y la respuesta del servidor retorna inmediatamente sin esperar a que la prueba termine
Y la UI muestra el estado como `"pendiente"` en la lista de ejecuciones

---

## Escenario: Ejecución pasa a "corriendo" y la vista se actualiza sin reload — AC-2

**HU-3.1 / AC-2**

Dado que una ejecución fue creada con estado `"pendiente"`
Y el worker ha comenzado a procesarla (la encontró en su polling de 5s)
Cuando la ejecución cambia su estado a `"corriendo"`
Entonces la vista de detalle de la ejecución (`/ejecuciones/[id]`) refleja el estado `"corriendo"` sin que el usuario tenga que recargar la página
Y no se requiere acción manual del usuario para ver el cambio

---

## Escenario: Ejecución termina y refleja el resultado real de Playwright — AC-3

**HU-3.1 / AC-3**

Dado que una ejecución está en estado `"corriendo"`
Y el worker ha terminado de ejecutar el script de Playwright
Cuando Playwright reporta el resultado final (todos los pasos completados)
Entonces el sistema actualiza `Ejecucion.estado` al valor correspondiente: `"paso"` si todos los pasos pasaron, `"fallo"` si alguno falló, `"reparado"` si hubo pasos reparados por self-healing
Y `Ejecucion.finAt` se graba con la marca de tiempo de fin
Y `Ejecucion.duracionMs` refleja la duración real medida por el worker

---

## Escenario: Pestaña global de ejecuciones agrupadas por proyecto — AC-4

**HU-3.1 / AC-4**

Dado que existen ejecuciones de múltiples proyectos en la base de datos
Cuando accedo a la pestaña `/ejecuciones` (vista global de ejecuciones)
Entonces veo todas las ejecuciones agrupadas por proyecto
Y cada fila muestra: caso de prueba, estado de ejecución, resultado y fecha
Y puedo navegar a la ejecución individual desde esa lista

---

## Escenario: Bloqueo de segunda ejecución concurrente para el mismo caso — AC-5

**HU-3.2 / AC-5**

Dado un caso de prueba con una ejecución en estado `"pendiente"` o `"corriendo"`
Cuando intento presionar "Ejecutar" por segunda vez para ese mismo caso
Entonces el sistema rechaza la acción con código HTTP 409 Conflict
Y el mensaje de error indica claramente que ya hay una ejecución en curso para ese caso
Y no se crea una segunda fila en `Ejecucion`

---

## Escenario: Ejecución en curso termina y permite nuevo disparo — AC-6

**HU-3.2 / AC-6**

Dado un caso de prueba con una ejecución en estado `"pendiente"` o `"corriendo"`
Y esa ejecución en curso termina (cambia a `"paso"`, `"fallo"`, `"reparado"` o `"errorMotor"`)
Cuando intento presionar "Ejecutar" nuevamente para ese mismo caso
Entonces el sistema permite el disparo sin restricciones
Y se crea una nueva ejecución en estado `"pendiente"`

---

## Escenario: Error del motor — script vacío — AC-7, AC-8

**HU-3.3 / AC-7, AC-8**

Dado un caso de prueba cuyo campo `script` está vacío o es solo espacios en blanco
Cuando el worker intenta ejecutar ese caso
Entonces la ejecución queda en estado `"errorMotor"`
Y el campo `Ejecucion.errorMsg` contiene un mensaje explicativo (ej: "Script vacío o no proporciondo")
Y no se crea ningún registro en `PasoEjecucion` para esa ejecución
Y la vista de detalle no muestra pasos falsos

---

## Escenario: Error del motor — script no ejecutable (parse error o archivo no existe) — AC-7, AC-8

**HU-3.3 / AC-7, AC-8**

Dado un caso de prueba cuyo campo `script` contiene texto que no es un script Playwright válido
Cuando el worker intenta ejecutar ese script escribiéndolo al archivo temporal y corriendo `npx playwright test`
Entonces la ejecución queda en estado `"errorMotor"`
Y `Ejecucion.errorMsg` contiene el mensaje de error devuelto por Playwright o por el sistema de archivos
Y no se insertan registros falsos en `PasoEjecucion` (la ejecución nunca llegó a correr pasos de prueba)
Y la vista de detalle muestra exactamente un paso con estado `"errorMotor"` y el mensaje de error del motor

---

## Escenario: Streaming de pasos — polling del cliente cada 2 segundos — AC-9

**HU-3.4 / AC-9**

Dado que una ejecución está en estado `"corriendo"`
Y el componente cliente de la vista de detalle (`ejecucion-client.tsx`) está montado
Cuando un paso de la prueba termina en el worker y se inserta en `PasoEjecucion`
Entonces al siguiente poll del cliente (intervalo de 2 segundos)
La vista de detalle muestra ese paso sin necesidad de recargar la página
Y los pasos previos permanecen visibles y ordenados por número

---

## Escenario: Paso recién agregado se distingue visualmente por ~2 segundos — AC-10

**HU-3.4 / AC-10**

Dado que una ejecución está en estado `"corriendo"` y la vista de detalle está visible
Cuando un nuevo paso se inserta en `PasoEjecucion` y el cliente lo recibe en el siguiente poll
Entonces el paso se renderiza con la clase CSS `.step.new` (o equivalente) que aplica un highlight visual
Y ese highlight se mantiene durante aproximadamente 2 segundos
Y después de ese período el estilo visual vuelve al de un paso normal
Y no se confunde con el historial de pasos anteriores

El highlight visual se implementa con una animación CSS (ej: `animation: write .34s ease-out` del mockup)
o un color de fondo transitorio. El计时器 se calcula en el cliente comparando `createdAt` del paso con `Date.now() - 2000ms`.

---

## Escenario: Pasos reflejan exactamente lo emitido por el worker, sin síntesis — AC-11

**HU-3.4 / AC-11**

Dado que una ejecución ha terminado y la vista de detalle se consulta después
Cuando reviso la lista de pasos en la vista de detalle
Entonces el orden de los pasos refleja exactamente el orden en que fueron emitidos por el reporter custom (`scripts/playwright-reporter.js`)
Y la descripción de cada paso coincide exactamente con lo reportado por Playwright
Y la duración de cada paso (`duracionMs`) refleja lo registrado por el worker
Y no se synthesizan ni inventan pasos adicionales que no fueron emitidos por el worker

---

## Escenario: End-to-end — flujo completo de disparo a resultado — AC-1, AC-2, AC-3

**HU-3.1 / AC-1, AC-2, AC-3 (flujo completo)**

Dado que existe un caso de prueba con script válido y no tiene ejecuciones en curso
Cuando presiono "Ejecutar" en la vista del caso
Entonces recibo respuesta inmediata con el ID de la ejecución creada en estado `"pendiente"`
Y aproximadamente 5 segundos después (cuando el worker hace su próximo polling) la ejecución pasa a `"corriendo"`
Y la vista de detalle se actualiza automáticamente mostrando `"corriendo"` sin reload (polling cada 2s)
Y cuando la prueba termina, la ejecución pasa a `"paso"` (si todo OK) o `"fallo"` (si algún paso falló)
Y la duración registrada (`duracionMs`) refleja el tiempo real de ejecución

---

## Escenario: End-to-end — errorMotor no muestra pasos falsos — AC-7, AC-8

**HU-3.3 / AC-7, AC-8 (flujo completo)**

Dado un caso de prueba cuyo script está vacío
Cuando presiono "Ejecutar" y el worker procesa esa ejecución
Entonces la ejecución termina en estado `"errorMotor"` con mensaje en `errorMsg`
Y cuando abro la vista de detalle de esa ejecución
Veo cero pasos en la lista (o un único paso de error del motor si el worker lo inserts)
Y no hay ningún paso quesimule una ejecución de prueba (porque nunca corrió)
Y el mensaje de error es claro sobre la causa del fallo del motor

---

## Escenario: Vista de detalle de ejecución con pasos en vivo y artifactos — AC-9, AC-10, AC-11, más AC-3

**HU-3.4 / AC-9, AC-10, AC-11 (vista de detalle)**

Dado que una ejecución está en estado `"corriendo"` o ya terminó
Cuando abro la URL `/ejecuciones/[id]`
Entonces veo el estado actual de la ejecución (`pendiente`, `corriendo`, `"paso"`, `"fallo"`, `"reparado"`, `"errorMotor"`)
Y veo la lista de pasos ordenados por número, cada uno con su descripción, estado y duración
Y si la ejecución está corriendo, los pasos aparecen progresivamente sin reload gracias al polling de 2s
Y el paso recién agregado tiene un indicador visual de "recién agregado" (highlight) que dura ~2s
Y si la ejecución ya terminó, la lista de pasos refleja fielmente lo emitido por el worker
Y la duración total (`duracionMs`) y timestamps `inicioAt` / `finAt` están presentes

---

## Escenario: Worker procesa una ejecución pendiente end-to-end — Flujo interno del worker

**HU-3 (trabajo interno del worker)**

Dado que existe una `Ejecucion` en estado `"pendiente"`
Y el worker hace su polling y la selecciona con `FOR UPDATE SKIP LOCKED`
Cuando el worker procesa esa ejecución
Entonces actualiza `Ejecucion.estado = "corriendo"` y graba `inicioAt`
Y lee `CasoPrueba.script` y `scriptFileName` de la BD
Y escribe el script a un archivo temporal en `os.tmpdir()/playwright-vortex/<runId>-<sanitized>.spec.ts`
Y ejecuta `npx playwright test <archivo-temporal> --reporter=custom` con el reporter custom
Y por cada línea de stdout que sea JSON válido, extrae el evento y hace `INSERT PasoEjecucion`
Y al terminar, actualiza `Ejecucion.estado` al resultado final, graba `finAt` y `duracionMs`
Y elimina el archivo temporal
Y si el script está vacío, marca `"errorMotor"` inmediatamente sin ejecutar Playwright

---

## Escenario: Lock de concurrencia con SELECT FOR UPDATE NOWAIT — AC-5, AC-6

**HU-3.2 / AC-5, AC-6 (mecanismo de lock)**

Dado el mecanismo de lock transaccional implementado en `lib/ejecuciones/actions.ts`
Cuando `dispararEjecucion(casoPruebaId)` es llamado
Entonces dentro de una transacción Prisma se ejecuta `SELECT ... FOR UPDATE NOWAIT`
buscando ejecuciones del mismo `casoPruebaId` con estado en `('pendiente', 'corriendo')`
Si se encuentra una → se lanza `{ status: 409, body: { error: 'conflict', message: '...' } }`
Si no se encuentra → se crea `Ejecucion` con `estado = 'pendiente'` en la misma transacción
Y la transacción hace COMMIT
Y el lock se libera automáticamente al terminar la transacción

---

## Diseño de componentes UI (referencia del mockup `acta-mockups.html`)

### Vista de detalle de ejecución (`/ejecuciones/[id]`)

La vista de detalle sigue el diseño del mockup (sección "Ejecución", pantalla 5):

- **Topbar**: título "Ejecución #[id]", breadcrumb con nombre del caso, estado con `.pill` (`.p-pass` para `"paso"`, `.p-fail` para `"fallo"`, `.p-heal` para `"reparado"`), botones de acción
- **Grid de 2 columnas**:
  - Izquierda: `.ledger` con la lista de `.rstep` (steps de ejecución)
  - Derecha: video + capturas (para fases futuras, placeholder en HU-3)
- **`.rstep`**: grid de 3 columnas (número, descripción, duración). Variantes de color: `.fail` (fondo `#FCF3F2`), `.heal` (fondo `#FCF8EE`)
- **`.step.new`**: animación CSS `write .34s ease-out` (highlight temporal de ~2s) + texto "recién agregado" en `.meta`
- **`.pill p-pass`**: verde (`--seal`, `#0E6B4F`), fondo `#EDF7F3`
- **`.pill p-fail`**: rojo (`--stamp`, `#A8322A`), fondo `#FBEFEE`
- **`.pill p-heal`**: ámbar (`--amber`, `#A9741A`), fondo `#FCF8EE`
- **`.chip-secret`**, **`.chip-param`**: estilos mono para parámetros y secretos en descripciones de paso
- **Estado `"errorMotor"`**: `.stamp` (sello inclinado rojo) con mensaje de error del motor

### Página global `/ejecuciones`

- Lista tipo `.ledger` con filas agrupadas por proyecto
- Cada fila muestra: caso de prueba, estado con `.pill`, resultado, fecha
- Navegación a `/ejecuciones/[id]` al hacer clic en la fila

### Botón "Ejecutar"

- Visible en la fila del caso (en la vista de lista de casos) y en la vista de detalle del caso
- Al presionarse: llama a `POST /api/ejecuciones` con `{ casoPruebaId }`
- Respuesta inmediata (sin esperar ejecución)
- Si la respuesta es 409: muestra mensaje de error de concurrencia en UI

---

## Estados de la ejecución y sus representaciones visuales

| `Ejecucion.estado` | `.pill` clase | Color | Significado |
|---|---|---|---|
| `"pendiente"` | `.p-idle` | gris | Esperando worker |
| `"corriendo"` | `.p-running` | azul | Worker ejecutando |
| `"paso"` | `p-pass` | verde `--seal` | Todos los pasos conformes |
| `"fallo"` | `p-fail` | rojo `--stamp` | Al menos un paso falló |
| `"reparado"` | `p-heal` | ámbar `--amber` | Falló pero fue auto-reparado |
| `"errorMotor"` | `.stamp` (sello rojo inclinado) | rojo `--stamp` | Falló el motor, no la prueba |

---

## Endpoints de la API

| Método | Ruta | Propósito | AC |
|---|---|---|---|
| `POST` | `/api/ejecuciones` | Crear ejecución (disparar) | AC-1 |
| `GET` | `/api/ejecuciones/[id]` | Obtener detalle con pasos ordenados por número | AC-2, AC-9, AC-11 |
| `GET` | `/api/ejecuciones` | Listar todas (para `/ejecuciones`) | AC-4 |

---

## Archivos nuevos o modificados (para referencia del implementador)

### Scripts del worker
- `scripts/playwright-worker.ts` — worker standalone que polling-ea BD cada 5s
- `scripts/playwright-reporter.js` — reporter custom de Playwright (JSON por stdout)

### Lógica de negocio
- `lib/ejecuciones/actions.ts` — `dispararEjecucion(casoPruebaId)` con lock NOWAIT, pre-check de concurrencia

### API routes
- `app/api/ejecuciones/route.ts` — `POST` para disparar
- `app/api/ejecuciones/[id]/route.ts` — `GET` para detalle con pasos

### Páginas
- `app/(dashboard)/ejecuciones/page.tsx` — listado global agrupado por proyecto
- `app/(dashboard)/ejecuciones/[id]/page.tsx` — página de detalle
- `app/(dashboard)/ejecuciones/[id]/ejecucion-client.tsx` — componente con polling cada 2s y highlight

### Configuración
- `package.json` — agregar `@playwright/test` en `devDependencies`
- `playwright.config.ts` — configuración base para el worker
- `docker-compose.yml` — asegurar que el worker se arranque junto con la app

### Modificados
- `app/(dashboard)/casos/casos-client.tsx` — agregar botón "Ejecutar" en cada fila de caso

---

## Notas de implementación

1. **Polling de 2s en el cliente**: se implementa con `useEffect` + `setInterval` en `ejecucion-client.tsx`. El cleanup del efecto debe limpiar el `setInterval` al desmontar.

2. **Highlight de 2s para pasos nuevos**: el cliente compara `createdAt` de cada paso con `Date.now() - 2000`. Los pasos dentro de esa ventana reciben la clase `.step.new` (o equivalente) que activa la animación CSS.

3. **Reporter custom**: `scripts/playwright-reporter.js` escribe un objeto JSON por línea a `stdout`. El worker hace `spawn` con `{ stdio: ['pipe', 'pipe', 'pipe'] }` y consume `stdout` línea por línea con `try { JSON.parse(line) } catch { continue }`.

4. **Lock NOWAIT**: capturar el error específico de Postgres (`lock_not_available`) y convertirlo en HTTP 409. El código Prisma debe usar `$transaction` + `$queryRaw` con template literal sql.

5. **Script como texto**: no usar `fs.access` ni validar rutas. El worker recibe el contenido en `CasoPrueba.script` y lo escribe a archivo temporal.

6. **Archivo temporal**: se crea en `os.tmpdir()/playwright-vortex/`. El nombre incluye el `runId` para evitar colisiones. Se elimina al terminar la ejecución (incluso si hay error).

7. **Timeout global**: el worker mata cualquier ejecución que supere los 5 minutos (`timeoutMs: 300000` en la configuración de Playwright).

8. **No se sintetizan pasos**: la única fuente de verdad para los pasos es el output del reporter custom. Si Playwright no emite un paso, no se inserta.
