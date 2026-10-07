# API

Rutas HTTP de `vortest-web` (`app/api/**`). Las usan los componentes cliente del dashboard, el grabador y el motor. No es una API pública versionada: puede cambiar junto con la interfaz.

## Convenciones

- **Autenticación**: cookie de sesión `vortest_session` (iron-session). Sin sesión válida → `401 { error: "No autenticado" }`. Un usuario borrado o suspendido cuenta como sin sesión.
- **Permisos**: se validan en el servidor con el alcance del rol (ver [arquitectura](./arquitectura.md#autorización)). Sin permiso → `403`; recurso inexistente o fuera de alcance → `404`.
- **Errores**: `{ error: string, message?: string }`. `message` está en español y se puede mostrar al usuario; nunca incluye trazas, mensajes de Prisma o rutas del servidor (el detalle queda en el log). Un cuerpo JSON inválido → `400 { error: "validation" }`.
- **Rutas internas** (`/api/internal/**`): no usan sesión sino el encabezado `X-Internal-Secret`, y el middleware no las intercepta (así pueden recibir archivos grandes por streaming).

## Ejecuciones

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/casos/:id/ejecutar` | Encola una ejecución del caso. `201 { ejecucionId, redirectTo }`. `409 { error: "ejecucion_en_curso", ejecucionId }` si ya hay una en curso; `409 { error: "caso_inactivo" }`. Es el punto de entrada que usa la interfaz. |
| GET | `/api/ejecuciones` | Lista ejecuciones del alcance del usuario. |
| POST | `/api/ejecuciones` | Alternativa a `/casos/:id/ejecutar` con `{ casoPruebaId }`. |
| GET | `/api/ejecuciones/:id` | Detalle con pasos, subacciones, artefactos y acta. Es lo que consulta el detalle mientras la ejecución está en curso. |
| POST | `/api/ejecuciones/:id/detener` | Cancela una ejecución en cola o en curso. `409` si ya terminó. |
| POST | `/api/ejecuciones/:id/acta` | Genera (o regenera con el mismo consecutivo) el Acta en PDF. `{ ok, actaId, consecutivo, downloadUrl }`. Dos pedidos simultáneos consumen un solo consecutivo. |
| GET | `/api/actas/:id/download` | Descarga el PDF del acta. |
| GET | `/api/artefactos/:id` | Sirve un video, captura o traza. |
| GET | `/trace-viewer/:ruta*` | Visor de trazas de Playwright servido por la app (misma sesión, la evidencia no sale a otro sitio). Uso: `/trace-viewer/index.html?trace=/api/artefactos/:id`. |

## Casos de prueba

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/casos` | Lista casos del alcance. Con `?parentOptions=true&proyectoId=…` devuelve los candidatos a caso padre. |
| POST | `/api/casos` | Crea un caso subiendo un script (`multipart/form-data`). |
| GET, PUT, DELETE | `/api/casos/:id` | Detalle, edición (código, nombre, responsable, script) y borrado. `409` si el código ya existe en el proyecto. |
| GET | `/api/casos/:id/parametros` | Parámetros del caso. |
| PATCH | `/api/casos/:id/parametros/:paramId` | Cambia el valor por defecto. Los parámetros que vienen de una credencial no se pueden editar (`403`). |
| GET, POST | `/api/casos/:id/juego-de-datos` | Juegos de datos del caso. |

## Grabador

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/grabador/sesiones` | Inicia una grabación (opcionalmente con credencial o caso padre). Devuelve `{ sessionId, wsUrl, token }`. `503` si el grabador del host no responde o no hay cupo. |
| GET, PATCH, DELETE | `/api/grabador/sesiones/:id` | Estado, actualización y borrado de la sesión. |
| POST | `/api/grabador/sesiones/:id/pause` · `/resume` · `/heartbeat` | Control de la sesión en curso. |
| POST, PATCH | `/api/grabador/sesiones/:id/pasos` | Pasos grabados (lectura del spec para mostrar). |
| PATCH, DELETE | `/api/grabador/sesiones/:id/pasos/:pasoId` | Edición de un paso grabado. |
| POST | `/api/grabador/sesiones/:id/parametros` | Parametriza valores tecleados. |
| POST | `/api/grabador/sesiones/:id/guardar` | Guarda la grabación como caso (`{ script?, ejecutar? }`). `409` si ya se guardó o descartó. |
| POST | `/api/grabador/sesiones/:id/descartar` | Descarta la grabación. |

## Organización y usuarios

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| GET, POST | `/api/espacios` | crear: superadmin | Espacios del alcance; alta. |
| GET, PUT, DELETE | `/api/espacios/:id` | superadmin o admin del espacio | Detalle, edición, borrado. |
| GET, POST, DELETE | `/api/espacios/:id/admins` | superadmin | Admins del espacio. |
| GET, POST | `/api/proyectos` | crear: admin del espacio | Proyectos (con `?espacioId=` incluye métricas). |
| GET, PUT, DELETE | `/api/proyectos/:id` | acceso al proyecto | Detalle, edición, borrado. |
| GET, POST, DELETE | `/api/proyectos/:id/testers` | admin del espacio | Testers del proyecto. |
| GET | `/api/proyectos/:id/credenciales` | superadmin | Credenciales del proyecto, sin el valor cifrado. |
| GET, POST | `/api/credenciales` | superadmin | Todas las credenciales (sin valor) y alta: `{ proyectoId, nombre, storageState, vence? }`; el `storageState` se valida y se cifra. |
| DELETE | `/api/credenciales/:id` | superadmin | Borra una credencial. |
| GET, POST | `/api/usuarios` | admin o superadmin | Usuarios del alcance; alta (un admin sólo crea testers). |
| PATCH | `/api/usuarios/:id` | admin o superadmin | Rol y estado. Un admin sólo suspende testers de sus espacios. |
| GET, PUT | `/api/usuarios/:id/espacios` | superadmin | Espacios asignados a un admin. |
| PATCH | `/api/perfil` | sesión | Nombre para mostrar. |
| POST | `/api/perfil/password` | sesión | Cambio de contraseña. |
| GET, POST | `/api/logout` | — | Cierra la sesión y redirige al login. |

## Rutas internas

| Método | Ruta | Llamador | Qué hace |
|---|---|---|---|
| POST | `/api/internal/artefactos/upload` | motor | Recibe un artefacto (`multipart`, campos `ejecucionId`, `fileName`, `tipo`, `sha256`, `bytes`, `metadata`, `file`). Verifica hash y tamaño mientras escribe; si no coinciden, borra el archivo y responde `400`. Devuelve `{ artefactoId }`. |

Del lado del motor (`vortest-engine`):

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/internal/cancel/:jobId` | `X-Internal-Secret`. `200 { cancelled: true }` si esta réplica tenía el trabajo (también si estaba esperando turno); `404 { cancelled: false }` si no. |
| GET | `/health` · `/health/ready` | Salud del proceso. |

## Mensajes por RabbitMQ

| Cola | Sentido | Contenido |
|---|---|---|
| `engine.execute` | web → motor | `{ pattern: "engine.execute", data: ExecuteJobMessage }`: `jobId`, `scriptText`, `scriptFileName`, `navegador`, `inputStorageState?`, `timeoutMs`. |
| `engine.events` | motor → consumidor | `{ pattern, data: EngineEvent }` con `jobId` y un `payload` tipado (`env`, `step`, `substep`, `log`, `assertion`, `captura-test`, `end`). Contrato en `vortest-web/lib/queue/engine-contract.ts`. |
