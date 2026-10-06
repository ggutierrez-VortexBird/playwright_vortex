# Delta for modelo-de-datos-prisma

## MODIFIED Requirements

### Requirement: Esquema extendido para modo grabador

El sistema DEBE extender el esquema Prisma para soportar el modo grabador con 4 tablas nuevas, 1 enum nuevo y extensiones no-breaking a 3 tablas existentes. Todas las columnas y modelos nuevos deben crearse con valores `default` o `nullable` para mantener compatibilidad con datos existentes.

(Previously: 11 tablas + 3 enums; sin soporte para sesiones de grabación)

#### Modelos nuevos

- `sesionGrabacion`: id (uuid), `proyectoId` FK Restrict, `usuarioId` FK Restrict, `casoPruebaId?` FK SetNull, `nombre: String`, `urlInicial: String`, `ambiente: String`, `navegador: String` (default `'chromium'`), `credencialId?` FK SetNull, `storageState: Json?` (snapshot precargado, descifrado server-side), `token: String?` (HMAC-SHA256), `tokenUsado: Boolean @default(false)`, `estado: String` (`iniciando | activa | pausada | detenida | descartada | guardada | error`), `mensajeError: String?`, `startedAt: DateTime?`, `endedAt: DateTime?`, `createdAt`/`updatedAt`. Índices: `@@index([proyectoId])`, `@@index([usuarioId])`, `@@index([estado])`.

- `pasoGrabado`: id (uuid), `sesionId` FK Cascade, `numero: Int` con `@@unique([sesionId, numero])`, `tipo: String` (`navegar | clic | escribir | seleccionar | esperar | verificar | generico`), `origen: String` (`grabado | manual | generico`), `descripcion: String`, `selectorPrincipal: Json`, `selectoresRespaldo: Json`, `valor: String?`, `esValorSensible: Boolean @default(false)`, `assertionKind: String?`, `createdAt`. Índice: `@@index([sesionId])`.

- `parametroGrabacion`: id (uuid), `sesionId?` FK Cascade, `casoPruebaId?` FK Cascade, `nombre: String` con `@@unique([sesionId, nombre])`, `valorDefecto: String?`, `origen: String` (`manual | credencial`), `credencialId: String?`, `enUso: Boolean @default(true)`, `createdAt`. Índice: `@@index([casoPruebaId])`.

- `juegoDeDatos`: id (uuid), `casoPruebaId` FK Cascade, `nombreArchivo: String`, `filas: Json`, `createdAt`. Índice: `@@index([casoPruebaId])`.

#### Enum nuevo

- `CasoOrigen`: `subirScript | grabador | mixto` con default `subirScript` en `casoPrueba.origen`.

#### Extensiones no-breaking

- `casoPrueba`: + `origen CasoOrigen @default(subirScript)`, + back-relations `pasosGrabados PasoGrabado[]`, `parametros ParametroGrabacion[]`, `juegosDeDatos JuegoDeDatos[]`.
- `ejecucion`: + `loteId: String?` (HU-G13 data-driven, stub para uso futuro).
- `pasoEjecucion`: + `videoInicioMs: Int?`, `videoFinMs: Int?` (HU-G18 capítulos de video, stub para uso futuro).

#### Scenario: Migración no rompe seed existente

- GIVEN la DB con casos pre-existentes (ej. `CP-AUTH-01` con `origen` indefinido)
- WHEN se ejecuta `npx prisma migrate dev --name hu_g21_grabador_models`
- THEN Postgres aplica la migración sin errores
- AND los casos preexistentes quedan con `origen='subirScript'`
- AND las columnas nuevas (`loteId`, `videoInicioMs`, `videoFinMs`) quedan `NULL`
- AND el flujo de ejecución existente sigue funcionando

#### Scenario: Cascade borra pasos al descartar sesión

- GIVEN una `sesionGrabacion` con 10 `pasoGrabado`
- WHEN se ejecuta `DELETE FROM sesionGrabacion WHERE id = ?`
- THEN Postgres borra la sesión Y los 10 pasos asociados (cascade)
- AND los `parametroGrabacion` huérfanos se borran también

### Requirement: SesionGrabacion.token persistido para reconexión post-reinicio

El sistema DEBE persistir el token HMAC en `sesionGrabacion.token` para que el recorder-worker pueda reiniciarse sin invalidar sesiones activas. El flag `tokenUsado` DEBE asegurar que el token sea de un solo uso: una segunda conexión WS con el mismo token DEBE ser rechazada.

#### Scenario: Token persistente sobrevive reinicio del recorder

- GIVEN una sesión activa con `token` y `tokenUsado=true`
- WHEN el recorder-worker se reinicia y el cliente WS reconecta con el mismo `token`
- THEN el recorder valida contra DB, encuentra la sesión activa, acepta la conexión
- Y los frames se reanudan sin reiniciar Chromium

#### Scenario: Reuso de token es rechazado

- GIVEN una sesión con `tokenUsado=true`
- WHEN un segundo cliente WS intenta conectar con el mismo `token`
- THEN el recorder cierra la conexión con código `4001`
- Y el cliente ve un toast "Token ya utilizado, vuelve a iniciar la grabación"