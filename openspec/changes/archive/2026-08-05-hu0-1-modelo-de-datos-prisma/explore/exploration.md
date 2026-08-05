# Exploración — HU-0.1 Modelo de datos Prisma

> **Cambio**: `hu0-1-modelo-de-datos-prisma`
> **Fase**: 1 — EXPLORER (Vorkan v2.1.0)
> **Fecha**: 2026-08-05
> **Modo de persistencia**: `hybrid` (filesystem + Engram)
> **Estado del repo**: stack planeado pero NO instalado. No existe `package.json`, ni `prisma/schema.prisma`. Esta fase es **solo análisis**: no se escribe `schema.prisma`, no se instalan dependencias.

---

## Current State

Hoy el repositorio es un **bootstrap documental de Fase 0**:

- Existe `openspec/config.yaml` (creado en `sdd-init`) con `project: acta`, `stack: nextjs-prisma-postgres`, `mode: hybrid`, `strict_tdd: true`, `status: stack-planned-not-installed`.
- Existe la especificación del producto en `documentacion/`:
  - `idea-negocio-playwright-vortex.md` — la "evidencia es ejecutable", jerarquía empresa → proyecto → caso → ejecución, un único superusuario (crecimiento pensado, no realizado).
  - `historias-usuario-playwright-vortex.md` — 9 fases de HUs. **HU-0.1** (esta) define "espacio, proyecto, caso de prueba, ejecución, paso, artefacto, acta" como migraciones de Prisma. Las HUs posteriores agregan: `usuario` (HU-1.1), `usuario_espacio` (HU-6.1), `credencial` (HU-7.1), consecutivos notariales `CP-XXXX-YY` y `EJC-YYYY-NNNNNN` (HU-5.3), `version del sistema bajo prueba` libre (HU-5.1), valor de credencial cifrado (HU-7.1).
  - `plan-implementacion-playwright-vortex.md` — sección 2 lista 10 entidades: `usuario`, `espacio`, `usuario_espacio`, `proyecto`, `caso_prueba`, `ejecucion`, `paso_ejecucion`, `artefacto`, `acta`, `credencial`. Sección 8 fija Postgres externo en prod, volumen persistente para artefactos.
- Existe `acta-mockups.html` con la referencia visual (CP-2503-01, EJC-2026-001184, REQ-2503, sha256 de artefactos, etc.).
- **No hay código**: ni `prisma/`, ni `package.json`, ni `next.config.*`, ni `tsconfig.json`. El `db.ts` con el patrón `globalForPrisma` (visto en `.agents/skills/nextjs-developer/references/data-fetching.md`) **aún no existe** — se creará en la primera HU de implementación.
- El subproyecto `playwright_vortex` (subcarpeta git) tiene solo `README.md` con el nombre.

**Implicación para Fase 1**: lo que hoy es "modelo de datos" se reduce a una **especificación analítica** (este artefacto). La codificación del modelo espera a la primera HU de implementación que scaffoldee el proyecto Next.js + Prisma.

---

## Affected Areas

> Esta fase **no toca código**; las "áreas afectadas" son las que la HU-0.1 en sí nombra y las zonas del repo que se beneficiarán (o dependerán) del resultado.

### Áreas que la HU-0.1 nombra explícitamente
- `prisma/schema.prisma` — **NO se crea en Fase 1**. Se declara en Fase 4 (DESIGNER) y se implementa en Fase 7 (IMPLEMENTER) de la primera HU que scaffoldee el repo (`Fase 1` del plan de implementación).
- `prisma/migrations/<timestamp>_init/migration.sql` — idem.
- `prisma/seed.ts` (opcional) — idem, si se quisiera popular un usuario superusuario en dev.

### Áreas del repo que consumirán este modelo (Fase 1–9 del plan)
- `app/` (Next.js App Router) — Server Components y Server Actions que tocan `espacio`, `proyecto`, `caso_prueba`, `ejecucion`, `acta`, `credencial`.
- `lib/db.ts` — singleton `PrismaClient` (patrón documentado en `nextjs-developer/references/data-fetching.md`).
- `worker/` — proceso Node de larga vida que polla `ejecucion` en estado `pendiente`, dispara `playwright test`, escribe `paso_ejecucion` y `artefacto`, marca la ejecución como `pasó`/`falló`/`reparado` y provoca la creación de `acta`.
- `app/api/...` (route handlers) — endpoints para consultar/descargar actas, servir video y trace en streaming, descargar PDF.
- Volumen persistente (Docker) — guarda archivos físicos de `artefacto` (video, capturas, trace) y PDFs de `acta`. Las rutas en disco **viven en columnas del modelo** (`path`, `output_path`).

### Áreas documentales a congelar con esta decisión
- `documentacion/convenciones-modelo-de-datos.md` (a crear en Fase 4 DESIGNER) — contendrá las decisiones de esta exploración para que PRODUCTORES, CODE REVIEWERS y el propio EQUIPO las respeten.
- `openspec/changes/hu0-1-modelo-de-datos-prisma/specs/<domain>/spec.md` (a crear en Fase 3 SPEC-WRITER) — delta spec con escenarios Given/When/Then.

### Áreas NO afectadas por esta exploración
- `documentacion/idea-negocio-playwright-vortex.md`, `historias-usuario-playwright-vortex.md`, `plan-implementacion-playwright-vortex.md` — **NO se modifican** (regla dura: no toco `documentacion/`).
- `openspec/config.yaml` — **NO se modifica** (es de Fase 0).
- `.agents/` — no se toca.

---

## Approaches

> Comparación de enfoques para los **10 ejes de decisión** que el orquestador listó. Cada eje termina con la recomendación adoptada.

### Eje 1 — Convención de nombres (tabla y columna)

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. snake_case en DB + PascalCase en modelos Prisma (con `@map`/`@@map`)** | Legible en SQL nativo (joins, EXPLAIN, `psql`); nombres de tabla/campo coinciden con la convención Postgres y con los nombres en `.sql` de las migraciones; las HUs que se referencian a `caso_prueba`, `paso_ejecucion`, `acta` (snake del plan) hablan el mismo idioma que el storage. | Hay que escribir `@map` en **cada** columna — boilerplate. Errores de tipeo en `@map` no se detectan hasta la migración. | Bajo |
| **B. camelCase en DB (default Prisma sin mapeo)** | Escribir el schema es casi trivial. | Nombres de tabla como `casoPrueba` se ven extraños en Postgres; rompe la consistencia con el resto del stack (Next.js usa camelCase en JS pero Postgres prefiere snake_case); queries raw SQL limpias son más difíciles. | Bajo |
| **C. snake_case natural en Prisma (modelo = nombre SQL)** | Sin `@map`. | Los nombres de modelos en TS rompen la convención de PascalCase de Prisma (forzaría `caso_prueba` en TS, chocando con lint de `nextjs-react-typescript`). | Bajo |

**Recomendación**: **A — snake_case en Postgres, PascalCase/camelCase en la API Prisma**. Documentado por Postgres (estilo recomendado) y por los ejemplos de Prisma con `@map`/`@@map`. La plan ya habla en snake (`caso_prueba`, `paso_ejecucion`, `usuario_espacio`) — vale la pena respetarlo en DB.

**Modelo Prisma quedaría (ejemplo)**: `model CasoPrueba { ... @@map("caso_prueba") }`, `createdAt DateTime @default(now()) @map("created_at")`.

---

### Eje 2 — Estrategia de IDs

| Enfoque | Pros | Contras | Orden temporal | Tamaño |
|---|---|---|---|---|
| **A. CUID v2 (`@default(cuid())`)** | URL-safe, sin colisiones en una sola DB, más corto que UUID. Estándar de facto en apps Next.js + Prisma. | No es lexicográficamente ordenable a través del tiempo (CUID v1 sí, pero v2 es random). | No (v2) / Sí (v1) | 24 chars |
| **B. UUID v4 (`@default(uuid())`)** | Amplio soporte, libs en todos los lenguajes. | No ordenable, 36 chars, ruido en logs. | No | 36 chars |
| **C. UUID v7 (`@default(uuid(7))`)** | Ordenable por tiempo + random suffix. Postgres lo soporta. | Menos adopción fuera de Prisma. | Sí | 36 chars |
| **D. ULID (`@default(ulid())`)** | Ordenable, 26 chars, lexicográfico. | Menos idiomático en Prisma/Next.js. | Sí | 26 chars |
| **E. Autoincrement integer** | Compacto, ordenado nativamente, joins baratos. | Filtra cuántas ejecuciones/actas existen, expone volumen de negocio, complica multi-instance/migrations y es feo en URLs. | Sí | 4–8 bytes |

**Recomendación**: **C — UUID v7 (`@default(uuid(7))`)**. Da orden temporal (importante para orden natural en listados y para debugging — `ORDER BY id` ≈ `ORDER BY created_at`), 36 chars siguen siendo URL-safe, y está soportado nativamente por Prisma 6+ con Postgres. Como ya tenemos `created_at`, el orden no es estrictamente dependiente del id, pero un id ordenable ayuda a日志 de worker, sha256 anchors y debugging en `psql`.

**Alternativa aceptable**: **A — CUID** si en Fase 4 (DESIGNER) se decide que el equipo prefiere CUID por familiaridad (NextAuth, Clerk, etc. usan CUID). Documentar la decisión en `conventions`.

---

### Eje 3 — Timestamps y soft delete

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. `createdAt` + `updatedAt` en todas las tablas, hard delete** | Modelo simple, sin columnas zombie. `updatedAt` ayuda a invalidación de caché. | Borrar un `proyecto` con `caso_prueba` y `ejecucion` rompe FKs (resuelto por Eje 5 — `Restrict`). | Bajo |
| **B. `createdAt` + `updatedAt` + `deletedAt` (soft delete)** | "Restauración" posible, auditoría. | Casi todo el código tiene que hacer `where: { deletedAt: null }`; queries agregadas se complican; los `acta` firmados no pueden "des-firmarse". | Alto |
| **C. `createdAt` + `updatedAt` + `activo` boolean** | Tabla `caso_prueba` ya tiene `activo` en el plan. | No resuelve auditoría real. | Bajo |

**Recomendación**: **A — `createdAt` + `updatedAt` en todas las tablas; hard delete; usar `activo: boolean` en `proyecto` y `caso_prueba` (ya previstos en el plan)** para "desactivar" sin borrar. Las actas son evidencia y **no** se borran (ver Eje 5).

**Detalle de nomenclatura**: `created_at`/`updated_at` en DB, `createdAt`/`updatedAt` en Prisma (con `@map`).

---

### Eje 4 — Enums: nativos de Postgres vs string libre

| Enfoque | Pros | Contras |
|---|---|---|
| **A. Enum nativo de Postgres (`enum EjecucionEstado { ... }`)** | Validación en DB, aparece como tipo en `psql`, autocompletado en Prisma Client. | Migraciones de enum son pesadas (no podés borrar un valor sin `ALTER TYPE` con validación — `ALTER TABLE` lockean). Cambiar valores futuros requiere migración. |
| **B. String con `CHECK` constraint** | Migraciones triviales, agregar valor = `ALTER TABLE ... DROP/ADD CONSTRAINT`. | Más permisivo en la capa DB; validación termina en la app. |
| **C. String libre + validación en app (Zod)** | Máxima flexibilidad. | Sin validación en DB; errores en runtime. |

**Recomendación**: **A — enums nativos de Postgres** para los estados críticos:

- `EjecucionEstado`: `pendiente | corriendo | paso | fallo | reparado | error_motor` (el último para HU-3.3 — diferenciar "falló la prueba" de "falló el motor").
- `EjecucionPasoEstado`: `pendiente | paso | fallo | reparado | skipped`.
- `ArtefactoTipo`: `video | captura | trace`.
- `PaseEstado` (para autofacturar el caso `activo`): `activo | inactivo` no necesita enum, alcanza un `boolean`.

El "reparado" es un estado de paso (además de `paso`/`fallo`) y NO un estado global de ejecución (la ejecución puede terminar "reparado" si pasó gracias a self-healing, pero se modela como `estado = paso` + flag o por la agregación de los pasos). Ver Eje 5 / Riesgos.

---

### Eje 5 — Cascadas vs Restrict

**Criterio rector**: criterio de aceptación #2 — *"Dado un caso de prueba, cuando se elimina el proyecto al que pertenece, entonces la relación queda protegida o en cascada según se defina explícitamente (no queda huérfano por accidente)."* Y el espíritu del producto: una ejecución nunca debería desaparecer silenciosamente — el acta es evidencia.

| Relación | Recomendación | Razón |
|---|---|---|
| `caso_prueba.proyecto_id` → `proyecto.id` | **`onDelete: Restrict`** | Criterio de aceptación #2. Si querés borrar un proyecto con casos, **el sistema debe advertirte** (HU-2.2 lo prevé) y vos decidís explícitamente. Cascade sería peligroso: borraríamos el historial de ejecución junto con el proyecto. |
| `ejecucion.caso_prueba_id` → `caso_prueba.id` | **`onDelete: Restrict`** | Una ejecución pasada es evidencia; no debe desaparecer al borrar el caso. Si necesitás "borrar" el caso, primero desactivás (`activo = false`) o migrás los casos. |
| `paso_ejecucion.ejecucion_id` → `ejecucion.id` | **`onDelete: Cascade`** | Un paso **no existe** sin su ejecución. Si la ejecución se borra (en tests o un escenario de limpieza puntual), los pasos van con ella. La tabla nunca se consulta sin pasar por la ejecución. |
| `artefacto.ejecucion_id` → `ejecucion.id` | **`onDelete: Cascade`** | Idem. Pero **ojo**: el archivo físico en el volumen persistente hay que borrarlo a mano (signal/app-level cleanup). Cascade de Prisma solo borra la fila, no los bytes. Por eso este cascade se cubre en Fase 7 (IMPLEMENTER) con un cleanup hook. |
| `acta.ejecucion_id` → `ejecucion.id` | **`onDelete: Restrict`** + `UNIQUE(ejecucion_id)` | El acta **es** la evidencia legal. No debe poder borrarse con la ejecución. Aunque la relación es 1-a-1, si por error se intenta borrar la ejecución con acta, Restrict lo impide. La UNIQUE en `ejecucion_id` enforces "1-a-1 acta ↔ ejecución". |
| `usuario_espacio.usuario_id` → `usuario.id` | **`onDelete: Cascade`** | Si se borra un usuario, sus memberships desaparecen. |
| `usuario_espacio.espacio_id` → `espacio.id` | **`onDelete: Cascade`** | Idem. |
| `proyecto.espacio_id` → `espacio.id` | **`onDelete: Restrict`** | Misma lógica que caso→proyecto: un espacio con proyectos no se borra en silencio. HU-2.2 prevé warning explícito. |
| `credencial.proyecto_id` → `proyecto.id` | **`onDelete: Restrict`** | Una credencial es sensible. No debe caer con el proyecto. |

**Resumen del spirit del modelo**: PK padre (proyecto, caso, ejecución, acta) → **Restrict** (no se borra con la fila padre); child rows que no tienen sentido sin el padre (paso, artefacto, membership) → **Cascade**. El criterio de aceptación #2 queda así cubierto: borrar proyecto = bloqueado por FK, no huérfanos silenciosos.

---

### Eje 6 — Relación 1-a-1 acta ↔ ejecucion

**Recomendación**: **`UNIQUE(ejecucion_id)` en `acta`** + FK con `Restrict` + relación Prisma `acta Ejecucion?` (campo opcional del lado ejecución).

- Esto **enforces** que una ejecución tenga **a lo sumo** un acta.
- Para que la creación sea atómica (ejecución finaliza → acta se inserta), la app usa `INSERT ... ON CONFLICT` (o `upsert`) en Fase 7. Si dos workers intentan crear acta, el segundo `ON CONFLICT (ejecucion_id) DO NOTHING` no rompe.
- Permite regenerar el acta: la app **actualiza** (`UPDATE acta SET ... WHERE ejecucion_id = $1`) la misma fila, conservando el `id`, el `consecutivo` y los "metadatos de firma" prometidos por el plan (`metadatos de firma` en la fila).
- La `ruta del documento generado` (PDF) se actualiza con cada regeneración.

---

### Eje 7 — Consecutivos notariales (`CP-XXXX-YY` y `EJC-YYYY-NNNNNN`)

**Recomendación**: **persistirlos como columnas en la fila**, no derivarlos en runtime.

- `caso_prueba.codigo` (string, formato `CP-XXXX-YY`) — generado en la app al crear el caso, validado con regex, **único por proyecto** (criterio de HU-2.3). XXXX = código REQ del proyecto, YY = correlativo por REQ. Esto exige un campo `req` (o `codigo_req`) en `caso_prueba`.
- `acta.consecutivo` (string, formato `EJC-YYYY-NNNNNN`) — generado al **crear** el acta, único global. YYYY = año, NNNNNN = correlativo anual. Como tiene un correlativo **anual**, hace falta un lock o sequence para generarlo sin colisión.

**Estrategia del correlativo anual** (Fase 7 — IMPLEMENTER):

- Opción priorizada: **contador en una tabla `consecutivo_anual(anio, ultimo)`** con `SELECT ... FOR UPDATE` → atómico en Postgres sin Redis. Simple, suficiente para un usuario.
- Opción descartada: `SEQUENCE` de Postgres — corre, pero Postgres no permite prefijo de año en la sequence (habría que concatenar y resetear manualmente cada año).
- Opción descartada: derivar en runtime — los criterios de aceptación #3 de HU-5.3 exigen "búsqueda por consecutivo en <1 s", lo que requiere índice → columna persistida.

**Implicación para Fase 1**: declarar `codigo` y `consecutivo` **como columnas obligatorias en el schema** (no como `String?` opcionales). Fase 4 (DESIGNER) diseñará el generador.

---

### Eje 8 — `version del sistema bajo prueba` (HU-5.1)

**Recomendación**: **campo libre en `proyecto`, no entidad aparte**.

- `proyecto.version_sistema` (`String` opcional) — la HU-5.1 habla de "cadena libre configurable por proyecto". No aparece en los listados de HUs, no tiene ciclo de vida propio, no se filtra ni se busca por ahí. Modelarlo como entidad aparte es over-engineering.
- Si en una fase futura aparecen múltiples "versiones configuradas por ambiente" (QA / preprod / prod), se splittea **en ese momento** creando `proyecto_version` con FK a `proyecto`. Mientras tanto, no.

---

### Eje 9 — Credenciales cifradas (HU-7.1)

**Recomendación**: **columna `valor` con tipo `bytea`** (no `text`).

- En Postgres, `bytea` es el tipo nativo para blobs binarios; la columna se ve como `\\xdeadbeef...` en `psql` (no en claro).
- La columna **no** es un `String` Prisma — es `Bytes`. Prisma lo soporta: `valor Bytes @db.ByteA`.
- El cifrado (AES-GCM con clave en env var) se hace en la app **antes** de persistir. El server **nunca** hace round-trip con el valor en claro: ni en logs, ni en queries, ni en el `acta` (HU-7.2 y HU-7.3).
- **Cuidado con Prisma**: `Bytes` no se filtra ni se ordena en queries sin `cast`. Como `valor` nunca se busca por valor, eso está bien.
- Los metadatos (`nombre`, `tipo`, `sesion_vence_at`) **sí** son `String`/`DateTime` y viven en la misma fila.

**Decisión alternativa si el equipo lo prefiere**: un `String` con `valor_cifrado` (formato base64). Funcionalmente equivalente, pero pierde el "tipo-hint" en DB. **Recomiendo `Bytes`**.

---

### Eje 10 — Metadata flexible (JSON)

**Recomendación**: **no usar `Json` por ahora**, pero dejar el switch listo.

- Ninguna HU pide todavía campos schema-less.
- Posibles usos futuros: `proyecto.config` (parametrización opcional), `ejecucion.metadata` (CLI args, env vars), `caso_prueba.parametros` (HU-2.3 menciona "parámetros `{{param}}`" pero el plan aclara que ese concepto quedó **fuera del MVP**).
- Cuando aparezcan, se modela con `Json @db.JsonB` en Postgres (índice posible). Prisma lo soporta desde v2.
- **Regla**: cada vez que se agregue un `Json`, documentar en la spec **qué claves se esperan** y validar con Zod en runtime. Sin JSON "salvaje" sin contrato.

**Excepción concreta de Fase 0 (no Json)**: el `log de pasos` que el plan menciona en `ejecucion` debe vivir como **`paso_ejecucion` (tabla aparte)**, no como `Json` en `ejecucion`. Razones: hay query por número de paso, filtro por estado, búsqueda por duración, agrupación para acta. `Json` sería pelearse con Postgres por algo que ya tiene tabla.

---

### Resumen de decisiones del modelo (lo que la implementación recibirá)

| Aspecto | Decisión |
|---|---|
| Naming DB | `snake_case` vía `@map`/`@@map` |
| Naming Prisma | PascalCase modelo + camelCase campo |
| ID | `uuid(7)` (Postgres nativo, ordenable) |
| Timestamps | `createdAt` + `updatedAt` en todas las tablas (snake_case en DB) |
| Soft delete | **No** — `activo: boolean` en `proyecto` y `caso_prueba` |
| Enums | Nativos Postgres (`EjecucionEstado`, `EjecucionPasoEstado`, `ArtefactoTipo`) |
| Cascadas | `Restrict` para PKs de evidencia (`proyecto`, `caso_prueba`, `ejecucion`, `acta`); `Cascade` para child rows (`paso_ejecucion`, `artefacto`, memberships) |
| 1-a-1 acta↔ejecución | `UNIQUE(ejecucion_id)` en `acta` + `Restrict` en FK |
| `CP-XXXX-YY` | `caso_prueba.codigo` (String, UK por proyecto) |
| `EJC-YYYY-NNNNNN` | `acta.consecutivo` (String, UK global) + tabla `consecutivo_anual` |
| `version_sistema` | `proyecto.version_sistema` (String opcional) |
| `credencial.valor` | `Bytes @db.ByteA` (cifrado en app) |
| Json libre | No en MVP; previsto para iteraciones |

---

## Recommendation

**Sí, estamos listos para abrir Fase 2 (PROPOSER).**

La decisión de fondo es: **el modelo de datos es un subproducto de las HUs, no un diseño "in the abstract"**. Las 10 entidades del plan derivan de:

- HU-0.1: `espacio`, `proyecto`, `caso_prueba`, `ejecucion`, `paso_ejecucion`, `artefacto`, `acta`.
- HU-1.1: `usuario`.
- HU-6.1: `usuario_espacio`.
- HU-7.1: `credencial`.

Y los **campos clave** no son negociables para Fase 0:

1. `caso_prueba.codigo` (CP-XXXX-YY, único por proyecto) — implica columna y un generador.
2. `caso_prueba.ruta_script` (referencia al `.spec.ts`) — implica convención de archivos (HU-0.2).
3. `caso_prueba.responsable` (string o FK a `usuario`) — ojo: con un solo superusuario hoy, podría ser `String` con el email y migrar a FK en Fase 6. **Recomiendo FK a `usuario` desde el día 1** — no cuesta nada y habilita HU-6.1 sin migración.
4. `acta.consecutivo` (EJC-YYYY-NNNNNN, UK global) — implica columna + `consecutivo_anual`.
5. `acta.ruta_pdf` (path en el volumen persistente) — implica convención de archivos físicos.
6. `credencial.valor` (Bytes cifrado) — implica columna `Bytes` + cifrado en app.
7. `ejecucion.estado` (enum nativo) — implica `EjecucionEstado` enum + `error_motor` distinct.
8. `paso_ejecucion.reparado` (boolean) — para flag de self-healing (HU-4.3).
9. `proyecto.version_sistema` (String, opcional) — para la meta-grid del acta (HU-5.1).
10. `proyecto.activo`, `caso_prueba.activo` (boolean) — para "desactivar" sin borrar.

**El modelo entero se puede declarar en una sola migración inicial** (no hay nada que dividir). Cuando llegue Fase 1 de implementación (la HU que scaffoldee el repo), la migración `0001_init` cubre las 10 tablas + 4 enums + 2 FKs bridge. No se prevén migraciones destructivas en la primera implementación.

**Pero hay 4 preguntas para el usuario antes de cerrar la spec** (ver `open_questions_for_user`). No son bloqueantes para Fase 2, pero la Phase 4 (DESIGNER) sí las necesita para escribir `schema.prisma` con los tipos correctos.

---

## Risks

1. **Stack no instalado** — la HU-0.1 cierra conceptualmente aquí, pero la migración inicial **no puede correrse** hasta que la primera HU de implementación scaffoldee el proyecto Next.js + Prisma. El criterio de aceptación #1 ("se crean todas las tablas sin errores") queda en **TODO** para la primera HU de implementación. **No se puede cerrar HU-0.1** sin esa corrida. (Ya documentado en `sdd-init/acta` en Engram.)
2. **`strict_tdd: true` sin runner** — cualquier test que se escriba contra el modelo (Fase 6) no se puede correr. Igual que arriba: la primera HU de implementación instala el runner.
3. **Decisión "snake_case en DB" sin input explícito del usuario** — el plan lista entidades en snake, pero no fija la convención de columnas. Si el usuario prefiere camelCase en DB, todos los `@map` son inútiles. **Resoluble en checkpoint 1**.
4. **`uuid(7)` requiere Postgres 13+ y Prisma 6.x** — la versión de Postgres no está fijada en `docker-compose.dev.yml` (no existe aún). Si F1 cae a Postgres < 13, `uuid(7)` no funciona. **Recomiendo fijar Postgres 16 en la migración inicial**.
5. **Consecutivos anuales con `SELECT FOR UPDATE`** — funciona con un solo worker. Si en un futuro se escala a varios workers, hay que pensar en advisory lock o `pg_advisory_xact_lock`. **Documentar** como riesgo futuro, no bloquear ahora.
6. **`Restrict` en `acta.ejecucion_id`** — fase futura de "purga de ejecuciones de prueba de dev" no podrá borrar ejecuciones con actas. Si se necesita esa purga, hay que exponer un endpoint de admin (Fase 9). **Aceptable** porque la idea de negocio ya dice "evidencia ejecutable".
7. **`credencial.valor` como `Bytes`** — hay que recordar en cada lugar de la app "no hacer `select: { valor: true }`". Documentar en la convención para evitar filtraciones por código.
8. **HU-3.3 introduce estado `error_motor`** en `ejecucion` — está en la HU pero no en el plan. El plan menciona "estado [pendiente/corriendo/pasó/falló/reparado]". **Discrepancia menor** — el estado se debe agregar al enum. Marcar como riesgo para que Phase 3 (SPEC-WRITER) lo cubra.
9. **El acta menciona "metadatos de firma"** — el plan los lista pero no los define. Si "metadatos de firma" es JSON arbitrario, contradice nuestra decisión de "no JSON libre en MVP". **Abrir en pregunta para el usuario**.
10. **Si HU-2.3 introduce "parámetros `{{param}}`"** — el plan dice "fuera del MVP", pero la HU-2.3 todavía lo menciona en el contexto de "registrar caso con su script". Riesgo de scope creep; la spec de HU-0.1 debe **dejar el modelo agnóstico** (no agregar `parametros` todavía).

---

## Ready for Proposal

**Yes — listo para Fase 2 (PROPOSER).**

### Lo que Fase 2 (sdd-propose) debe entregar
- `proposal.md` con la decisión de cada uno de los 10 ejes y la justificación (este análisis es la base).
- Vinculación a la HU-0.1 textual (criterios de aceptación).
- Plan de rollback: trivial (no hay código todavía); la única "válvula de escape" es **no commitear antes de que el usuario valide**.
- Decisiones a bloquear en checkpoint 1 (post-proposal): **naming**, **strategy de ID**, **estrategia de consecutivos**.

### Lo que Fase 3 (sdd-spec) debe entregar
- `specs/<domain>/spec.md` con escenarios Given/When/Then para los **3 criterios de aceptación** de HU-0.1, en español.
- Escenarios derivados para cada uno de los 10 ejes.

### Lo que Fase 4 (sdd-design) debe entregar
- `design.md` con el **diagrama ER** de las 10 tablas + 4 enums + 2 FKs bridge.
- `documentacion/convenciones-modelo-de-datos.md` con el detalle de `@map`, enums, estrategia de soft-delete (`activo`), estrategia de consecutivos.
- (Cuando llegue el momento) el `prisma/schema.prisma` real — **no en este cambio** (HU-0.1 es "modelo definido", pero la implementación va en la primera HU de Fase 1).

### Bloqueos que la próxima fase debe resolver
1. **Snake_case vs camelCase en DB** (producto).
2. **UUID v7 vs CUID** (técnico, requiere alineación con `clerk-nextjs-patterns`).
3. **Postgres 16 mínimo** (para `uuid(7)`).
4. **`metadatos de firma` de `acta`**: ¿JSON, columnas dedicadas, o diferido a Fase 5?

### Bandeja de salida para HU-0.1
- Crear checkpoint 1 al cerrar la proposal.
- El usuario debe dar visto bueno **antes** de pasar a SPEC-WRITER.

---

## Apéndice — Mapa rápido: HU → entidad/campo

| HU | Entidad / campo que obliga |
|---|---|
| HU-0.1 | `Espacio`, `Proyecto`, `CasoPrueba`, `Ejecucion`, `PasoEjecucion`, `Artefacto`, `Acta` |
| HU-1.1 | `Usuario` (email, password_hash, rol) |
| HU-2.1 | `Espacio.nombre`, `Espacio.color` |
| HU-2.2 | `Proyecto.espacioId`, `Proyecto.nombre`, `Proyecto.ambiente`, `Proyecto.activo` |
| HU-2.3 | `CasoPrueba.codigo` (UK por proyecto), `CasoPrueba.rutaScript`, `CasoPrueba.responsableId` (FK `Usuario`), `CasoPrueba.activo` |
| HU-2.5 | `Espacio.color` (ya en HU-2.1) |
| HU-3.1 | `Ejecucion.estado` (enum) |
| HU-3.2 | Lock en `Ejecucion` (no se modela en DB; vive en app con `casoPruebaId` + `estado in ('pendiente','corriendo')` consultado atómicamente) |
| HU-3.3 | `Ejecucion.estado = 'error_motor'` (enum value) |
| HU-3.4 | `PasoEjecucion.createdAt` (timestamp por paso) |
| HU-4.1 | `PasoEjecucion.estado`, `PasoEjecucion.duracionMs`, `PasoEjecucion.descripcion` |
| HU-4.2 | `Artefacto.tipo = 'video' \| 'captura' \| 'trace'`, `Artefacto.path`, `Artefacto.sha256` |
| HU-4.3 | `PasoEjecucion.reparado` (boolean) |
| HU-4.4 | `Artefacto.tipo = 'trace'` (ya en HU-4.2) |
| HU-5.1 | `Acta.id`, `Acta.rutaPdf`, `Acta.metadata` (cuidado con JSON), `PasoEjecucion.estado` (para la tabla "Resultado por paso"), `Artefacto.sha256` (para "Integridad de los artefactos"), `Proyecto.version_sistema` |
| HU-5.2 | `Acta.rutaPdf` (regenerable) |
| HU-5.3 | `CasoPrueba.codigo` (formato `CP-XXXX-YY`), `Acta.consecutivo` (formato `EJC-YYYY-NNNNNN`), tabla `ConsecutivoAnual(anio, ultimo)` |
| HU-6.1 | `Usuario`, `UsuarioEspacio(usuarioId, espacioId)` |
| HU-7.1 | `Credencial.proyectoId`, `Credencial.nombre`, `Credencial.tipo`, `Credencial.valor` (Bytes), `Credencial.sesionVenceAt` |
| HU-7.2, HU-7.3 | `Credencial.valor` (nunca se `select`ea en claro) |

---

## Apéndice — Diagrama ER (texto, a refinar en Fase 4)

```
usuario (id, email, password_hash, rol, created_at, updated_at)
espacio (id, nombre, color, activo, created_at, updated_at)
usuario_espacio (usuario_id, espacio_id, created_at)  -- PK compuesta
proyecto (id, espacio_id, nombre, ambiente, descripcion, version_sistema, activo, created_at, updated_at)
caso_prueba (id, proyecto_id, codigo, nombre, ruta_script, responsable_id, activo, created_at, updated_at)
  -- UK: (proyecto_id, codigo)
ejecucion (id, caso_prueba_id, estado, inicio_at, fin_at, duracion_ms, created_at, updated_at)
  -- estado: enum EjecucionEstado
paso_ejecucion (id, ejecucion_id, numero, descripcion, estado, duracion_ms, self_healed, error_msg, created_at)
  -- estado: enum PasoEjecucionEstado
artefacto (id, ejecucion_id, tipo, path, sha256, bytes, created_at)
  -- tipo: enum ArtefactoTipo
  -- UK opcional: (ejecucion_id, tipo, nombre) si queremos unicidad por nombre
acta (id, ejecucion_id, consecutivo, ruta_pdf, generated_at, created_at, updated_at)
  -- UK: (ejecucion_id) -- enforza 1-a-1
  -- UK: (consecutivo) -- global
consecutivo_anual (anio, ultimo)
  -- PK: anio
credencial (id, proyecto_id, nombre, tipo, valor, sesion_vence_at, created_at, updated_at)
  -- valor: bytea (cifrado en app)
```

**Conteo**: 10 tablas + 1 tabla auxiliar (`consecutivo_anual`) + 3 enums (`EjecucionEstado`, `PasoEjecucionEstado`, `ArtefactoTipo`).

---

## open_questions_for_user

> Bloqueantes para Fase 4 (DESIGNER), no para Fase 2 (PROPOSER). Documentadas para no perderlas.

1. **`Snake_case` en DB vs `camelCase`** — el plan lista entidades en snake, pero no fija la convención de columnas. ¿Confirmás `snake_case` para todo en DB? (Recomiendo sí.)
2. **`uuid(7)` vs `cuid()`** — UUID v7 es ordenable por tiempo, 36 chars, Postgres 16+. CUID es 24 chars, random en v2, estándar Next.js/Clerk. ¿Cuál priorizamos?
3. **Postgres 16 mínimo** — para soportar `uuid(7)`. ¿OK? ¿O preferís CUID y abrir Postgres más viejo?
4. **`metadatos de firma` de `acta`** — el plan los menciona sin definir. ¿JSON, columnas dedicadas (`firmado_por`, `firmado_at`, `hash_firma`), o diferir a Fase 5?
5. **`responsable` en `caso_prueba` como FK a `usuario` desde el día 1** — implica que la tabla `usuario` se crea en la migración inicial (ya prevista por HU-1.1). ¿OK?

---

## skill_resolution

- `nextjs-developer` — cargado (paths injected por orquestador antes de Fase 1). Usado para entender el patrón `globalForPrisma` y la organización App Router.
- `nextjs-react-typescript` — cargado. Define convención de código que la app tendrá: kebab-case, named exports, TS estricto, Server Components por default. **No impacta el modelo de Prisma directamente**, pero fija la convención de **variables TS** que referencian al modelo (PascalCase modelos, camelCase campos).
- `nextjs-app-router-patterns` — cargado. Define estructura de `app/`, `loading.tsx`, `error.tsx`, `route.ts`. **No impacta el modelo de Prisma directamente**; impacta **dónde** van a vivir los DAOs/repositorios en la siguiente fase: `lib/db.ts` (singleton) + `app/<recurso>/actions.ts` (server actions) + `app/<recurso>/page.tsx` (server component que hace `await db.x.findMany()`).
- `sdd-explore` — propia skill de la fase, leyó y cumplió.
- `sdd-phase-common` (shared) — leída para cargar convención de persistencia hybrid y return envelope.
- `openspec-convention` (shared) — leída para path `openspec/changes/<change>/explore/exploration.md`.

---

## artifacts_written

- Este archivo: `openspec/changes/hu0-1-modelo-de-datos-prisma/explore/exploration.md`
- `open_questions_for_user` se replicará en el output del sub-agente para que el orquestador tome la decisión en el checkpoint 1.
- `state.yaml` se actualizará con `explore.completed: true`.
- Engram: observación `sdd/hu0-1-modelo-de-datos-prisma/explore` (topic_key reutilizable; update, no duplicado).
