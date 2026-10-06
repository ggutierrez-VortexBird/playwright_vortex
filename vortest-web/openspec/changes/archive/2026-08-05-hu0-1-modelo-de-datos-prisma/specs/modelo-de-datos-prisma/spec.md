# Spec: modelo-de-datos-prisma

## Purpose

Define the complete Prisma schema for ACTA: 10 domain entities + 1 auxiliary table + 3 native Postgres enums, with explicit cascading rules, unique constraints, and audit timestamps. NEW capability (no prior spec to delta against).

## Requirements

### Requirement: Esquema de 11 tablas + 3 enums

The system MUST definir un esquema Prisma con 11 tablas y 3 enums nativos Postgres, con `createdAt`/`updatedAt` (`Timestamptz(6)`, `@default(now())`/`@updatedAt`) en todas las tablas principales. Toda entidad usa `id String @id @default(uuid())` (uuid v4).

#### Entidades (campo: tipo [+restricciones])

- `usuario` (HU-1.1): `email: String @unique`, `passwordHash: String`, `rol: String @default("superadmin")`.
- `espacio`: `nombre: String`, `color: String`, `activo: Boolean @default(true)`.
- `usuarioEspacio` (bridge): `usuarioId: String` FK Cascade, `espacioId: String` FK Cascade, PK `(usuarioId, espacioId)`.
- `proyecto`: `espacioId: String` FK Restrict, `nombre: String`, `ambiente: String`, `descripcion: String?`, `versionSistema: String?` (HU-5.1), `activo: Boolean @default(true)`.
- `casoPrueba`: `proyectoId: String` FK Restrict, `codigo: String` con `UNIQUE(proyectoId, codigo)` (`CP-XXXX-YY`), `nombre: String`, `rutaScript: String`, `responsableId: String` FK Restrict NOT NULL a `usuario.id`, `activo: Boolean @default(true)`.
- `ejecucion`: `casoPruebaId: String` FK Restrict, `estado: EjecucionEstado`, `inicioAt: DateTime?`, `finAt: DateTime?`, `duracionMs: Int?`.
- `pasoEjecucion` (no Json): `ejecucionId: String` FK Cascade, `numero: Int`, `descripcion: String`, `estado: PasoEjecucionEstado`, `duracionMs: Int?`, `selfHealed: Boolean @default(false)` (HU-4.3), `errorMsg: String?`, `createdAt`.
- `artefacto`: `ejecucionId: String` FK Cascade, `tipo: ArtefactoTipo`, `path: String`, `sha256: String`, `bytes: Int`.
- `acta` (sin firma — Fase 5): `ejecucionId: String @unique` FK Restrict, `consecutivo: String @unique` global (`EJC-YYYY-NNNNNN`), `rutaPdf: String`, `generatedAt: DateTime?`.
- `credencial` (HU-7.1): `proyectoId: String` FK Restrict, `nombre: String`, `tipo: String`, `valor: Bytes @db.ByteA` (cifrado AES-GCM en app), `sesionVenceAt: DateTime?`.
- `consecutivoAnual` (aux): `anio: Int @id`, `ultimo: Int`.

#### Enums nativos Postgres

`EjecucionEstado` = `pendiente | corriendo | paso | fallo | reparado | errorMotor` (HU-3.3). `PasoEjecucionEstado` = `paso | fallo | reparado`. `ArtefactoTipo` = `video | captura | trace`.

#### Scenario: Esquema completo coherente con todas las HUs

- GIVEN el modelo definido
- WHEN se ejecuta `prisma migrate dev --name init`
- THEN Postgres crea 11 tablas + 3 enums sin errores
- AND cada tabla tiene los campos mínimos del plan (sin campos pendientes)

### Requirement: Cascadas explícitas (Restrict o Cascade, nunca SetNull implícito)

The system MUST declarar `onDelete` explícito en TODAS las FKs: `casoPrueba→proyecto` Restrict; `ejecucion→casoPrueba` Restrict; `pasoEjecucion→ejecucion` Cascade; `artefacto→ejecucion` Cascade; `acta→ejecucion` Restrict; `proyecto→espacio` Restrict; `credencial→proyecto` Restrict; `usuarioEspacio→*` Cascade.

#### Scenario: Borrar un proyecto con casos asociados es rechazado

- GIVEN un proyecto con al menos un `casoPrueba`
- WHEN se ejecuta `DELETE FROM proyecto WHERE id = ?`
- THEN Postgres rechaza con FK violation (CA #2 de HU-0.1)
- AND ningún caso queda huérfano por accidente

#### Scenario: Borrar una ejecución borra pasos y artefactos en cascada

- GIVEN una ejecución con 5 `pasoEjecucion` y 2 `artefacto`
- WHEN se ejecuta `DELETE FROM ejecucion WHERE id = ?`
- THEN Postgres borra los 5 pasos y los 2 artefactos
- AND el acta (si existe) NO se borra (Restrict)

### Requirement: Relación 1-a-1 acta↔ejecución enforced por UK

The system MUST garantizar que cada `ejecucion` tiene a lo sumo UN `acta` mediante `UNIQUE(ejecucionId)` en `acta`.

#### Scenario: Intentar crear un segundo acta para la misma ejecución falla

- GIVEN una ejecución con un acta existente
- WHEN se intenta `INSERT INTO acta (ejecucionId, ...) VALUES (?, ...)` con el mismo `ejecucionId`
- THEN Postgres rechaza por violación de unique constraint
- AND la regeneración del acta se hace vía `UPDATE` (no `INSERT`)

### Requirement: Consecutivos notariales con unicidad estricta

The system MUST almacenar `casoPrueba.codigo` con `UNIQUE(proyectoId, codigo)` (`CP-XXXX-YY`) y `acta.consecutivo` con `UNIQUE` global (`EJC-YYYY-NNNNNN`).

#### Scenario: Dos casos con el mismo código en el mismo proyecto son rechazados

- GIVEN un proyecto con `casoPrueba.codigo = "CP-AUTH-01"`
- WHEN se intenta registrar otro caso con el mismo `codigo` en ese proyecto
- THEN Postgres rechaza por violación de unique constraint (HU-2.3)

#### Scenario: Acta con consecutivo duplicado es rechazada

- GIVEN un acta con `consecutivo = "EJC-2026-000001"`
- WHEN se intenta generar otra acta con el mismo consecutivo
- THEN Postgres rechaza por violación de unique constraint (HU-5.3: búsqueda O(1))

### Requirement: Tabla auxiliar `consecutivoAnual` para correlativo anual atómico

The system MUST incluir `consecutivoAnual(anio Int @id, ultimo Int)` que el worker actualiza con `SELECT ... FOR UPDATE` para emitir `EJC-YYYY-NNNNNN` sin race conditions.

#### Scenario: Dos workers emiten consecutivos distintos en el mismo año

- GIVEN `consecutivoAnual` con `anio=2026, ultimo=5`
- WHEN dos workers emiten `EJC-2026-` casi simultáneamente
- THEN uno emite `EJC-2026-000006` y el otro `EJC-2026-000007`
- AND no se repiten ni se pierden números

### Requirement: `casoPrueba.responsableId` es FK obligatoria

The system MUST declarar `casoPrueba.responsableId` como FK NOT NULL a `usuario.id` con `onDelete: Restrict`.

#### Scenario: No se puede crear un caso sin responsable

- GIVEN un proyecto y un usuario existentes
- WHEN se intenta `INSERT INTO casoPrueba (..., responsableId, ...) VALUES (..., NULL, ...)`
- THEN Postgres rechaza por NOT NULL violation

### Requirement: Enums nativos Postgres (no strings libres)

The system MUST usar enums nativos Postgres para `EjecucionEstado`, `PasoEjecucionEstado` y `ArtefactoTipo`. `EjecucionEstado` MUST incluir `errorMotor` (HU-3.3).

#### Scenario: Insertar ejecución con estado no enumerado es rechazado

- GIVEN un caso de prueba registrado
- WHEN se intenta `INSERT INTO ejecucion (..., estado, ...) VALUES (..., 'estadoInventado', ...)`
- THEN Postgres rechaza por violación de enum

### Requirement: Timestamps y flag `activo` consistentes

The system MUST incluir `createdAt`/`updatedAt` en TODAS las tablas principales. `proyecto.activo` y `casoPrueba.activo` MUST ser `Boolean @default(true)`.

#### Scenario: Toda fila nueva recibe timestamp automáticamente

- GIVEN una conexión a la DB
- WHEN se inserta cualquier fila en cualquier tabla
- THEN `createdAt` se llena con `now()` sin intervención del caller
- AND `updatedAt` se actualiza en cada `UPDATE`

### Requirement: `credencial.valor` almacenado como Bytes cifrados

The system MUST declarar `credencial.valor` como `Bytes @db.ByteA`. La app MUST cifrar con AES-GCM antes de escribir; la columna NUNCA debe seleccionarse en queries de UI.

#### Scenario: El valor de la credencial nunca aparece en texto claro

- GIVEN una credencial con valor real "MiPass123"
- WHEN la app guarda la credencial (cifrada)
- THEN la fila en `credencial` contiene bytes opacos en `valor`
- AND `SELECT valor FROM credencial` no devuelve texto plano recuperable sin la clave de cifrado

## Notes

Naming DB **camelCase** (Checkpoint 1, sin `@map`/`@@map`); IDs `uuid` v4; Postgres 16+. `acta` NO incluye columnas de firma (diferido a Fase 5). CA #1 de HU-0.1 queda como TODO hasta que la primera HU de implementación scaffoldee el stack. Refs: `proposal/proposal.md`, `explore/exploration.md`, HUs 1.1, 2.3, 3.3, 4.3, 5.1, 5.3, 7.1.
