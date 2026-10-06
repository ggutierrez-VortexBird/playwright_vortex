# Spec: modo-grabador

## Purpose

Proveer el modo grabador de ACTA: ciclo de vida de sesiones de grabación en vivo contra una URL objetivo, con live-streaming de browser vía WebSocket, autenticación HMAC de un solo uso, e integración con `Credencial` para precargar `storageState` en Chromium persistente. Esta spec cubre HU-G1 (Iniciar sesión) y sienta las bases para HU-G2..HU-G20 (no incluidas en este PR).

## Requirements

### Requirement: Iniciar sesión de grabación desde la UI

El sistema DEBE permitir a un superadmin autenticado iniciar una sesión de grabación completando un formulario con `nombre` (string libre), `urlInicial` (URL válida http/https), `ambiente` (QA | Staging | Prod), `credencialId` (UUID de una `Credencial` del proyecto) y `navegador` (MVP solo `chromium` activo). Al enviar el formulario, el sistema DEBE crear una fila `SesionGrabacion` con `estado='iniciando'`, solicitar un token HMAC al recorder-worker, devolver `{sessionId, wsUrl, token}` al cliente y redirigir a `/casos/grabar/[sesionId]`.

#### Scenario: Iniciar grabación exitosa

- GIVEN un proyecto con al menos una credencial activa y un superadmin autenticado
- WHEN completo el formulario con valores válidos y presiono "Iniciar grabación"
- THEN el recorder-worker abre Chromium con la `urlInicial` y precarga `storageState` desde la credencial
- AND el frontend abre WS con `?token=…`
- AND en menos de 5 segundos veo el badge "EN VIVO" y el `<canvas>` muestra la página objetivo
- AND la sesión queda con `estado='activa'` y `startedAt` poblado

#### Scenario: URL no accesible

- GIVEN el formulario completo
- WHEN la URL no responde dentro de 10s (timeout / DNS / cert inválido)
- THEN el recorder-worker marca la sesión `estado='error'` con `mensajeError` específico
- AND envía `{type:'error', msg}` por WS al cliente
- AND el frontend renderiza `error.tsx` con el motivo y un botón "Reintentar"
- AND no se crea un proceso Chromium huérfano

### Requirement: Live-streaming de browser vía WebSocket

El sistema DEBE exponer un WebSocket server (`RECORDER_PUBLIC_URL`) que reenvía frames JPEG del browser objetivo al cliente conectado. El primer frame DEBE llegar al cliente en menos de 5 segundos desde el click en "Iniciar grabación" en condiciones de dev local.

#### Scenario: Stream continuo de frames

- GIVEN una sesión activa con cliente WS conectado
- WHEN el recorder-worker invoca `cdp.send('Page.startScreencast', {format:'jpeg', quality:80, everyNthFrame:1})`
- THEN el cliente recibe `{type:'frame', data:'<base64jpeg>', ts}` cada ~33ms (30fps)
- AND el `<canvas>` actualiza la imagen con `requestAnimationFrame`
- AND la latencia visible es <500ms en dev

#### Scenario: Reconexión tras refresh del navegador

- GIVEN una sesión activa con un cliente WS conectado
- WHEN el cliente hace refresh de la página
- THEN el nuevo cliente re-abre WS con el mismo token
- Y el recorder valida, encuentra la sesión activa y retoma el stream
- Y el browser NO se reinicia (Chromium persistente sobrevive al refresh del frontend)

### Requirement: Autenticación del WebSocket con HMAC reusable

El sistema DEBE autenticar la conexión WS mediante un token HMAC-SHA256 generado con `SESSION_SECRET` y formato `${sessionId}|${userId}|${exp}`. El token ES REUTILIZABLE durante toda la vida de la sesión: refresh del navegador, reconexión por red, y múltiples pestañas deben poder abrir WS con el mismo token sin ser rechazados. La seguridad la aporta la firma HMAC (solo el frontend autorizado puede presentar el token) más la expiración TTL. El rechazo aplica solo a: token mal formado/expirado/firma inválida, sesión inexistente en DB, o sesión en estado terminal (`descartada`/`guardada`).

#### Scenario: Conexión con token válido y sesión activa

- GIVEN una sesión con `token` no expirado y `estado IN ('iniciando','activa','pausada','detenida')`
- WHEN el cliente abre WS con `?token=…`
- THEN el recorder valida la firma HMAC con `SESSION_SECRET`
- AND verifica que la sesión existe en DB y no está en estado terminal
- AND acepta la conexión y asocia el WS al `SessionEntry`

#### Scenario: Reconexión tras refresh del navegador

- GIVEN una sesión activa con un cliente WS conectado
- WHEN el cliente hace refresh de la página y re-abre WS con el mismo `token`
- THEN el recorder acepta la nueva conexión
- Y el nuevo WS queda asociado al mismo `SessionEntry`
- Y los frames del screencast siguen llegando sin reiniciar Chromium

#### Scenario: Token inválido

- GIVEN un cliente intenta conectar con un token manipulado o expirado
- WHEN abre WS con `?token=INVALIDO`
- THEN el recorder cierra la conexión con código `4001`
- Y no se transmiten frames

#### Scenario: Sesión en estado terminal

- GIVEN una sesión con `estado='descartada'` o `estado='guardada'`
- WHEN un cliente intenta conectar con su token
- THEN el recorder cierra la conexión con código `4001` indicando estado terminal
- Y el frontend debe mostrar "La sesión fue descartada/guardada" y ofrecer iniciar una nueva

### Requirement: Heartbeat y expiración por inactividad

El sistema DEBE esperar un mensaje `{type:'heartbeat'}` del cliente cada 15 segundos. Si transcurren `RECORDER_HEARTBEAT_TIMEOUT_MS` (default 600000 = 10 minutos) sin heartbeat, el sistema DEBE cerrar el `BrowserContext`, persistir los pasos capturados como borrador y marcar la sesión `estado='detenida'`.

#### Scenario: Heartbeat normal

- GIVEN una sesión activa
- WHEN el cliente envía `{type:'heartbeat'}` cada 15s
- THEN el recorder reinicia el timer de expiración
- AND la sesión sigue activa indefinidamente

#### Scenario: Expiración por inactividad

- GIVEN una sesión activa sin heartbeats
- WHEN pasan 10 minutos sin mensajes del cliente
- THEN el recorder cierra el `BrowserContext`
- Y marca la sesión `estado='detenida'` con `endedAt`
- Y los `pasoGrabado` capturados quedan en DB como borrador recuperable

### Requirement: Límite de sesiones concurrentes

El sistema DEBE rechazar el inicio de nuevas sesiones cuando hay `RECORDER_MAX_SESSIONS` (default 3) sesiones activas. El rechazo DEBE ser HTTP 503 con un mensaje claro.

#### Scenario: Límite alcanzado

- GIVEN `RECORDER_MAX_SESSIONS=3` con 3 sesiones activas
- WHEN un cuarto cliente intenta `POST /internal/start`
- THEN el recorder-worker devuelve `503 {error:'MAX_SESSIONS_REACHED'}`
- Y la API de Next.js propaga el error al cliente con un mensaje legible

### Requirement: Endpoint HTTP interno para iniciar sesión

El sistema DEBE exponer `POST /internal/start` en el recorder-worker autenticado con header `X-Internal-Secret: <RECORDER_INTERNAL_SECRET>`. El endpoint DEBE ser síncrono en su respuesta ({token, wsUrl}) pero asíncrono en el lanzamiento del browser (que ocurre en background tras retornar).

#### Scenario: Inicio válido

- GIVEN header `X-Internal-Secret` correcto
- WHEN POST con `{sessionId, userId, urlInicial, storageState, navegador}` válido
- THEN devuelve `200 {token, wsUrl}` en <500ms
- AND lanza Chromium en background tras retornar
- AND al terminar `page.goto`, marca la sesión `estado='activa'`

#### Scenario: Secret inválido

- GIVEN header `X-Internal-Secret` ausente o incorrecto
- WHEN POST a `/internal/start`
- THEN devuelve `401 {error:'unauthorized'}`

### Requirement: Limpieza de sesiones huérfanas al reiniciar el recorder

El sistema DEBE barrer al arrancar las `SesionGrabacion` con `estado IN ('iniciando', 'activa')` cuyo último heartbeat (updatedAt) fue hace más de 5 minutos, marcándolas `estado='error', mensajeError='worker reiniciado'`. La detección de "huérfana" NO depende del flag `tokenUsado` (eliminado: el token es reusable); se basa solo en la edad del último heartbeat.

#### Scenario: Orphan cleanup al arrancar

- GIVEN el recorder-worker arranca tras un crash
- WHEN ejecuta la query de limpieza
- THEN encuentra sesiones `estado='activa'` con `updatedAt < now - 5min`
- Y las marca `estado='error', mensajeError='worker reiniciado'`
- Y el frontend puede detectar el error al consultar `GET /api/grabador/sesiones/[id]`

### Requirement: Credenciales cifradas con AES-256-GCM

El sistema DEBE cifrar `credencial.valor` con AES-256-GCM usando una key derivada de `SESSION_SECRET` mediante `scrypt`. El endpoint `GET /api/proyectos/[id]/credenciales` NUNCA DEBE incluir el campo `valor` en la respuesta.

#### Scenario: Listar credenciales no expone secretos

- GIVEN un proyecto con 2 credenciales activas
- WHEN `GET /api/proyectos/[id]/credenciales` con sesión válida
- THEN devuelve `200 [{id, nombre, tipo, vence}, …]`
- AND ningún item incluye el campo `valor`

#### Scenario: Cifrado round-trip

- GIVEN un valor plaintext "MiPass123"
- WHEN la app llama `encryptCredencial("MiPass123")` y luego `decryptCredencial(ciphertext)`
- THEN el resultado es idéntico al plaintext original
- AND el ciphertext es distinto en cada llamada (nonce aleatorio)

## Notes

Esta spec cubre HU-G1 + la base para HU-G2..HU-G20. Los listeners DOM (`addInitScript`), el traductor de eventos a pasos legibles, y la persistencia de `PasoGrabado` se implementan en HU-G3 (PR-2 posterior). El reinicio del browser tras `Detener y revisar` y la reanudación en caliente se implementan en HU-G8 / HU-GR-2. La cancelación con cleanup se implementa en HU-G2.