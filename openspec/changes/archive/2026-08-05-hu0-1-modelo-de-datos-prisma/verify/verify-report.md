# Verification Report: hu0-1-modelo-de-datos-prisma

## Change
- **ID**: hu0-1-modelo-de-datos-prisma
- **Branch**: feature/hu0-1-modelo-de-datos-prisma
- **Mode**: hybrid
- **Date**: 2026-08-05
- **Persistence**: filesystem (`verify/verify-report.md`) + Engram (`sdd/hu0-1-modelo-de-datos-prisma/verify`)
- **Verifier**: sdd-verify sub-agent (mini Fase 8 de Vorkan v2.1.0)

## Context reminder

Esta HU es **atípica**: solo entrega análisis, propuesta, spec, diseño y tasks. NO se escribe `prisma/schema.prisma` real, NO se instala `package.json`, NO se ejecuta código runtime. La verificación que se documenta a continuación es de **coherencia y completitud de artefactos SDD**, no de código ejecutándose contra una DB Postgres real. El runner (Vitest + Postgres) llega en HU-0.3.

## Invariants Script
- **Command**: `powershell -NoProfile -ExecutionPolicy Bypass -File openspec\changes\hu0-1-modelo-de-datos-prisma\tests\invariants.test.ps1`
- **Exit Code**: 0
- **Tests Run**: 22
- **Tests Passed**: 22
- **Tests Failed**: 0
- **Tests Errored**: 0

### Resumen por bloque

| Block | Description | PASS |
|---|---|---|
| A | Existencia y estructura basica (5 tests: tamano minimo de cada artefacto) | 5/5 |
| B | spec.md tiene 9 requisitos y 11 escenarios, sin requisitos huerfanos (3 tests) | 3/3 |
| C | Decisiones binding del Checkpoint 1: camelCase, uuid v4, postgres 16, no firma metadata, responsableId FK (5 tests) | 5/5 |
| D | design.md incluye bloque schema.prisma completo con 11 modelos + 3 enums (3 tests) | 3/3 |
| E | tasks.md tiene 4 fases + markers de chained PRs / 400-line budget (4 tests) | 4/4 |
| F | Coherencia entre artefactos: 11 entidades en exploracion == 11 modelos en schema, 3 enums en design == 3 enums en spec (2 tests) | 2/2 |
| **Total** | | **22/22** |

## Completeness

| Artifact | Status | Notes |
|---|---|---|
| `explore/exploration.md` | OK | 31,921 bytes (>= 5,000). 386 lineas. Cubre 10 ejes de decision, riesgos documentados, open questions. |
| `proposal/proposal.md` | OK | 5,930 bytes (>= 1,000). Capability unica `modelo-de-datos-prisma`. Approach reversiona Checkpoint 1. |
| `specs/modelo-de-datos-prisma/spec.md` | OK | 7,927 bytes (>= 1,000). Exactamente 9 `### Requirement:` y 11 `#### Scenario:`, sin requisitos huerfanos. |
| `design/design.md` | OK | 16,804 bytes (>= 5,000). 394 lineas. Bloque schema.prisma completo (lineas 114-336, ~225 lineas). 10 decisiones tecnicas documentadas. |
| `tasks/tasks.md` | OK | 4,162 bytes (>= 1,000). 4 fases. 35 tareas prospectivas (10 + 9 + 13 + 3). |
| `tests/invariants.test.ps1` | OK | 16,902 bytes. 22 invariantes, 100% PASS. |
| `state.yaml` | OK | DAG faseado consistente: explore/propose/spec/design/tasks todas `completed: true`. `delivery_strategy.chained_prs_recommended: true` coherente con tasks.md. |

## Spec Compliance Matrix

| Requisito (HU-0.1 o decision binding) | Cubierto en spec | Cubierto en design | Cubierto en tasks | Notas |
|---|---|---|---|---|
| **CA #1**: la migracion inicial corre sin errores (11 tablas + 3 enums) | R1 ("Esquema de 11 tablas + 3 enums"), Scenario 1 | OK (Bloque 1) | OK (tasks 2.6-2.9) | tasks 2.7-2.9 verifican inspeccion SQL, diff vs plan, `prisma validate` |
| **CA #2**: FK Restrict `casoPrueba->proyecto` evita huerfanos | R2 ("Cascadas explicitas"), Scenarios 1-2 | OK (10 FKs con `onDelete` explicito) | OK (task 3.4) | task 3.4 prueba el reject de la FK |
| **CA #3**: campos minimos del plan | R1 | OK (todas las entidades + campos del plan + audit timestamps) | OK (task 2.8) | comparacion `schema.prisma` vs plan |
| **Binding 1**: camelCase en DB, sin `@map`/`@@map` | OK (Notes line 137) | OK (Bloque 1 sin `@map`, decision #3) | OK (task 2.3) | grep de `@map` en design solo aparece en el texto "Alternatives considered" |
| **Binding 2**: `uuid` v4 (`@default(uuid())`) en cada id | OK (R1, R5, R6) | OK (10/11 modelos usan `@default(uuid())`; ver Issues WARNING #1) | (implicito en bloque 1) | `ConsecutivoAnual.anio Int @id` no usa uuid por diseno (contador atomico) |
| **Binding 3**: Postgres 16+ | OK (R1, R8) | OK (`postgres:16` mencionado 3+ veces) | OK (task 1.6 `docker-compose.dev.yml`) | service `postgres:16` con volumen persistente |
| **Binding 4**: NO metadatos de firma en `acta` | OK (R3, sin firma) | OK (Bloque 1 comentario `// NO metadatos de firma (diferido a Fase 5)`) | (no aplica tasks) | tokens `firmadoPor/firmadoAt/hashFirma` AUSENTES |
| **Binding 5**: `casoPrueba.responsableId` FK NOT NULL Restrict a `usuario.id` | OK (R6 con scenario NOT NULL violation) | OK (Bloque 1 lineas 223, 229) | OK (task 3.8) | FK Restrict, sin `?`, inversa a `Usuario.casosAsignados` |
| **Binding 6**: NO campo `descripcion` libre en `casoPrueba` | OK (no en R1) | OK (campo AUSENTE de `model CasoPrueba`) | (no aplica tasks) | `casoPrueba` solo tiene id/proyectoId/codigo/nombre/rutaScript/responsableId/activo/createdAt/updatedAt |
| **Binding 7**: `usuarioEspacio` con PK compuesta | OK (R1 explicito) | OK (Bloque 1 `@@id([usuarioId, espacioId])`) | (no aplica tasks) | PK compuesta, sin surrogate id |
| **Binding 8**: `acta.consecutivo` String formato `EJC-YYYY-NNNNNN` | OK (R4 con Scenario UK global) | OK (line 299 `consecutivo String @unique // EJC-YYYY-NNNNNN, UK global`) | OK (task 3.11 cubre el counter, no formato) | formato solo documentado en comentario, sin CHECK en DB |
| **Binding 9**: `credencial.tipo` string libre en MVP | OK (R1 "tipo: String") | OK (line 317 `tipo String  // HU-7.1 lo promueve a enum en migracion aditiva`) | (no aplica tasks) | comentario explicito sobre promocioin futura |

## Correctness (Cross-Artifact Coherence)

**Coherencia entre artefactos — analisis adversarial**:

1. **Capability declared vs spec creado**: proposal.md declara `modelo-de-datos-prisma`; el spec vive en `openspec/changes/hu0-1-modelo-de-datos-prisma/specs/modelo-de-datos-prisma/spec.md`. **Consistente**.

2. **11 modelos del Bloque 1 de design.md** vs **11 entidades mencionadas en exploration.md**: parafraseo cruzado. exploracion.md no usa `model Usuario` (PascalCase) sino `usuario` (snake); el invariante F.1 pasa porque las regex aceptan la variante. **Consistente**.

3. **3 enums en design.md** vs **spec.md**: `EjecucionEstado`, `PasoEjecucionEstado`, `ArtefactoTipo`. El invariante F.2 verifica exactamente eso y pasa. Los valores coinciden (Pendiente | corriendo | paso | fallo | reparado | errorMotor en `EjecucionEstado`; el `errorMotor` cubre HU-3.3). **Consistente**.

4. **Decisiones binding del Checkpoint 1 reflejadas en todos los artefactos relevantes**:
   - proposal.md (tabla Approach): camelCase, uuid v4, postgres:16, no firma, FK Restrict, acta UK, etc. Si ✓
   - spec.md (9 requisitos + 11 scenarios): cubre todos los bindings. Si ✓
   - design.md (Bloque 1 + Decisions): explicito y completo. Si ✓
   - tasks.md: tasks 1.6 (postgres:16), 2.3 (schema.prisma exacto), 3.4 (cascade test), 3.7 (enum), 3.8 (responsableId), 3.10 (Bytes). Si ✓

5. **Exploration vs Checkpoint 1**: la exploration.md **recomienda snake_case con @map/@@map en DB** (Eje 1, linea 67), pero la propuesta y el Checkpoint 1 la invierten a **camelCase sin @map/@@map**. Esto esta **documentado en design.md line 26** como "Alternatives considered (recomendacion del explorer, rechazada por Checkpoint 1)". No es una contradiccion no controlada — es una evolucion rastreable de la decision. **Aceptable con trazabilidad**.

6. **Plan section 2 (10 entidades) + EXPLORER auxiliar (consecutivoAnual) = 11 modelos**: las 10 entidades del plan estan todas presentes en `Bloque 1` (`Usuario`, `Espacio`, `UsuarioEspacio`, `Proyecto`, `CasoPrueba`, `Ejecucion`, `PasoEjecucion`, `Artefacto`, `Acta`, `Credencial`). La auxiliar sugerida por EXPLORER (`consecutivoAnual`) esta presente. **Completo**.

7. **HUs futuras referenciadas**:
   - HU-2.3 (codigo unico por proyecto): cubierto por `@@unique([proyectoId, codigo])` en CasoPrueba + Scenario R4 ✓
   - HU-3.3 (error de motor): cubierto por `errorMotor` en enum `EjecucionEstado` ✓
   - HU-4.3 (self-healing): cubierto por `selfHealed: Boolean @default(false)` en PasoEjecucion + Scenario R3 + R8 (timestamps) ✓
   - HU-5.1 (metadata acta, version sistema): cubierto parcialmente — `versionSistema` en Proyecto ✓ + nota explicita "NO metadatos de firma" en acta ✓
   - HU-5.3 (consecutivos notariales CP-XXXX-YY / EJC-YYYY-NNNNNN): cubierto por columnas + tabla `consecutivoAnual` + scenarios R4 y R5 ✓
   - HU-7.1 (credencial cifrada): cubierto por `valor Bytes @db.ByteA` + Scenario R9 ✓

8. **HU-5.1 CA "Integridad de los artefactos" con `sha256` por artefacto**: modelo `Artefacto` tiene `sha256 String` ✓ y `bytes Int` ✓ (no solicitado explícitamente pero util).

## Design Coherence

**Decisiones tecnicas de design.md — analisis**:

- **Decision 1 (ubicacion y convencion)**: `prisma/schema.prisma` + singleton `lib/prisma.ts`. Coherente con `nextjs-react-typescript` (kebab-case) y patron `globalForPrisma` documentado en `nextjs-developer/references/data-fetching.md`. ✓
- **Decision 2 (generador)**: `prisma-client-js` vs `prisma-client` (ESM nuevo). Decision conservadora para MVP. ✓
- **Decision 3 (naming camelCase)**: explicito, menciona "sin `@map`/`@@map`". ✓
- **Decision 4 (uuid v4)**: explicito. ✓
- **Decision 5 (Timestamps Timestamptz 6)**: decision razonable; `pasoEjecucion` y `artefacto` correctamente SIN `updatedAt` (append-only). ✓
- **Decision 6 (singleton globalThis)**: patron oficial documentado. ✓
- **Decision 7 (prisma migrate dev versionado)**: vs `db push`. Coherente con CA #1 (exige migraciones commiteadas). ✓
- **Decision 8 (worker comparte cliente)**: single source of truth. ✓
- **Decision 9 (env vars)**: dev-friendly. ✓
- **Decision 10 (PK compuesta usuarioEspacio)**: idiomático, impide duplicados a nivel DB. ✓

**No hay contradicciones internas entre las decisiones del design ni con el approach del proposal**.

## Quality of schema.prisma block (Bloque 1)

**Verificacion detallada contra los 9 puntos del Paso 4.C**:

- **(C-1) FKs con `onDelete` EXPLÍCITO**: las 10 FKs tienen `onDelete: Restrict` o `onDelete: Cascade` declarados (verificado por grep). Sin `SetNull` ni default implicito. **OK**.
- **(C-2) `@@unique` bien declarados**:
  - `casoPrueba: @@unique([proyectoId, codigo])` ✓
  - `acta: ejecucionId @unique` (1-a-1) ✓
  - `acta: consecutivo @unique` (UK global) ✓
  - `pasoEjecucion: @@unique([ejecucionId, numero])` (BONUS — orden estable, evita duplicados por ejecucion) ✓
  - `usuario: email String @unique` ✓
  - **OK**.
- **(C-3) NOT NULL vs opcional**:
  - `casoPrueba.responsableId String` (sin `?`) ✓
  - `casoPrueba.codigo String` ✓
  - `casoPrueba.rutaScript String` ✓
  - `acta.consecutivo String` ✓
  - `acta.rutaPdf String` ✓
  - `credencial.valor Bytes` ✓
  - `credencial.tipo String` ✓
  - Opcionales correctos: `Proyecto.descripcion`, `Proyecto.versionSistema`, `PasoEjecucion.duracionMs`, `PasoEjecucion.errorMsg`, `Ejecucion.inicioAt/finAt/duracionMs`, `Acta.generatedAt`, `Credencial.sesionVenceAt`. ✓
- **(C-4) Enums nativos con todos los valores**:
  - `EjecucionEstado`: `pendiente | corriendo | paso | fallo | reparado | errorMotor` (6 valores, incluye `errorMotor` de HU-3.3) ✓
  - `PasoEjecucionEstado`: `paso | fallo | reparado` (3 valores) ✓
  - `ArtefactoTipo`: `video | captura | trace` (3 valores) ✓
- **(C-5) `acta.consecutivo` formato consistente con HU-5.3**: comentario inline `// EJC-YYYY-NNNNNN, UK global`. **OK en documentacion, pero sin CHECK constraint en DB** (ver Issues SUGGESTION #3).
- **(C-6) `credencial.valor` es `Bytes @db.ByteA`**: linea 318 exacta. **OK**.
- **(C-7) Sin campos `firmadoPor`, `firmadoAt`, `hashFirma` en `acta`**: AUSENTES (verificado por invariante C.4). **OK**.
- **(C-8) Sin `descripcion` libre en `casoPrueba`**: AUSENTE (verificado por grep). **OK**.
- **(C-9) Sin campos JSON libres**: AUSENTES en el modelo (decision EXPLORER Eje 10 — sin `Json` en MVP). **OK**.

## Spec quality analysis (9 requisitos + 11 scenarios)

- **Cobertura de los 3 CA de HU-0.1**: R1 cubre CA #1, R2 cubre CA #2, R1 (parcialmente) + design cubren CA #3. Distribucion adecuada. ✓
- **Testeabilidad de los 11 scenarios**: cada uno esta escrito como operacion SQL insertable (`INSERT INTO ...`, `DELETE FROM ...`) o como operacion Prisma, **dado** un estado concreto de DB. Son **testeables como integration tests con Vitest + Postgres efímero** (task 3.4-3.10 + 3.11 lo confirman). ✓
- **Scenarios de error**: 7 de los 11 son scenarios de rechazo/error:
  - 2 scenarios R2 (Restrict FK violation)
  - 1 scenario R3 (UK violation acta duplicada)
  - 2 scenarios R4 (UK violation codigo y consecutivo)
  - 1 scenario R5 (race condition con SELECT FOR UPDATE)
  - 1 scenario R6 (NOT NULL violation responsableId)
  - 1 scenario R7 (enum violation estado)
  - Happy path / verificacion positiva: 3 scenarios (R1, R8, R9)
  - **Buena proporcion error/happy**.
- **Keywords RFC 2119**: el spec usa `MUST` (11 veces), `MUST NOT`/`NUNCA` (R9). No se detectan `SHOULD`/`SHALL`/`MAY`. La eleccion es coherente con el nivel de exigencia del modelo (todo es MUST porque el modelo es contractual). **Aceptable**, aunque algunos escenarios de "best practice" podrian usar `SHOULD` en lugar de MUST si fueran preferenciales.

## Tasks quality analysis

- **35 tareas prospectivas**, distribuidas en 4 fases:
  - Phase 1 (scaffold): 10 tareas (1.1 - 1.10)
  - Phase 2 (schema + init): 9 tareas (2.1 - 2.9)
  - Phase 3 (cliente + tests): 13 tareas (3.1 - 3.13)
  - Phase 4 (verificacion pre-cierre HU-0.3): 3 tareas (4.1 - 4.3, con 4.3 expandido en 3 sub-items)
- **Trazabilidad al spec**: el pie del archivo (`9 reqs: R1 (2.7-2.9), R2 (3.4), R3 (3.5), R4 (3.6), R5 (3.11), R6 (3.8), R7 (3.7), R8 (3.9), R9 (3.10)`) mapea **explícitamente cada requirement con sus tasks**. **Excelente trazabilidad**.
- **PRs chain correctos**: PR 1 (scaffold + docker) -> PR 2 (schema + init) -> PR 3 (cliente + tests). Sin dependencias circulares. `feature-branch-chain` documentado en state.yaml y tasks.md. ✓
- **Review workload forecast**: 600 lineas estimadas, 400-line budget **HIGH**, Chained PRs YES. Documentado en `state.yaml.delivery_strategy` y replicado en tasks.md. ✓
- **Tareas especificas y verificables**: tasks con paths concretos (`prisma/schema.prisma`, `docker-compose.dev.yml`, `lib/prisma.ts`, `tests/schema/cascades.test.ts`, etc.). ✓

## Risks — coverage analysis

**Riesgos documentados en los artefactos**:

1. **"HU-0.1 no implementa nada"** (alto, marcado en proposal risk + state.yaml comments + tasks.md "PROSPECTIVAS"): **documentado y consistente**.
2. **HU-0.3 sugerido (scaffold + primera migración)** (state.yaml line 49-50, design.md "Migration/Rollout", tasks.md titulo): **documentado**.
3. **Snake_case vs camelCase invertido por Checkpoint 1** (design.md Alternatives considered): **documentado**.
4. **`uuid(7)` -> revertido a `uuid` v4 por Checkpoint 1** (no documentado explicitamente, pero si en design.md decision #4): **trazable**.
5. **`consecutivo_anual` con SELECT FOR UPDATE** (exploration Eje 7): **documentado**.
6. **`Restrict` en acta.ejecucion_id** (exploration Eje 5 risk #6): **documentado**.
7. **`credencial.valor` como `Bytes` y el riesgo de hacer `select: { valor: true }`** (exploration Eje 9): **documentado pero no transferido a design.md**. **Ver Issues SUGGESTION #1**.

**Riesgos NUEVOS detectados en esta verificacion (no en exploration ni design)**:

- **WARNING #1**: `design.md` Decision #4 dice `@default(uuid())` en "TODAS las entidades", pero `ConsecutivoAnual.anio` es `Int @id` (sin uuid). El schema es internamente consistente (contador atomico) pero la prosa sobregeneraliza. **No bloquea archive**. Inconsistencia leve entre prosa y codigo.
- **WARNING #2**: `credencial.tipo` es `String` libre ahora, con comentario "HU-7.1 lo promueve a enum en migracion aditiva". **No hay spec, design, ni task** que documente **como** se hara esa migracion aditiva (campo nuevo + backfill + drop default). Cuando llegue HU-7.1 esto requerira delta spec. **Riesgo de diseño menor**.
- **SUGGESTION #3**: `casoPrueba.codigo` y `acta.consecutivo` no tienen CHECK constraint de formato (`CP-XXXX-YY` / `EJC-YYYY-NNNNNN`) en DB. Spec documenta el formato en comentarios pero la validacion es solo app-level (no Prisma constraint, no SQL CHECK). **Mejora opcional para HU-0.3 o HU-5.3**.
- **SUGGESTION #4**: `pasoEjecucion` tiene `errorMsg: String?` para HU-4.1 (motivo del fallo), pero **NO** tiene un campo para registrar el **selector original vs. el selector reparado** cuando hay self-healing (HU-4.3). Solo el flag `selfHealed: Boolean`. Para audit trail completo de self-healing podria faltar evidencia de "que se cambio". **Mejora opcional para HU-4.3**.
- **SUGGESTION #5**: spec R7 dice "Insertar ejecucion con estado no enumerado es rechazado" pero **la invariante del formato exacto de los valores del enum** (`pendiente`, `corriendo`…) no se testea explicitamente. Confianza via type Prisma. Aceptable.
- **SUGGESTION #6**: La invariante F.1 (coherencia exploracion vs schema) usa regex tolerantes a variantes (snake/camel, con/sin tilde) — son robustas pero podrian tener falsos positivos. Probado y funciona, no es problema actual.

## Issues

### CRITICAL (bloquean archive)

**Ninguno.**

Las 9 decisiones binding del Checkpoint 1+2 estan respetadas. Los 3 criterios de aceptacion de HU-0.1 estan cubiertos por al menos un requisito del spec. Los 11 scenarios son testeables. El schema.prisma tiene FKs y UKs consistentes con la spec. Los 22 invariantes pasan.

### WARNING (no bloquean archive pero hay que registrar)

- **W-1**: `design.md` Decision #4 promete `@default(uuid())` para "TODAS las entidades", pero `ConsecutivoAnual.anio` es `Int @id` (contador atomico). El schema es internamente coherente, pero la prosa sobregeneraliza. Sugerencia: editar la prosa para aclarar que la regla aplica a entidades de dominio (10) y `ConsecutivoAnual` es auxiliar.

- **W-2**: `credencial.tipo` queda como `String` libre con promesa de migrar a enum en HU-7.1. No hay delta spec ni task que documente el plan de esa migracion aditiva (campo nuevo + backfill + drop). Se debera crear como parte de HU-7.1 cuando llegue.

- **W-3**: `credencial.valor` como `Bytes` exige disciplina app-level ("nunca `select: { valor: true }`"). El exploration lo menciona (Eje 9), el design lo declara, pero no hay un `documentacion/convenciones-modelo-de-datos.md` que lo registre explicitamente. Esa convencion fue listada como entregable del Phase 4 DESIGNER (`documentacion/convenciones-modelo-de-datos.md`, no creado en este change).

### SUGGESTION (mejoras opcionales)

- **S-1**: Agregar CHECK constraint (o validacion Prisma) al formato `CP-XXXX-YY` para `casoPrueba.codigo` y `EJC-YYYY-NNNNNN` para `acta.consecutivo`. Spec R4 / R5 lo menciona como documentacion, pero no enforcement a nivel DB.
- **S-2**: Considerar agregar campos de auditoria para self-healing (selector_original, selector_reparado) en `PasoEjecucion`. Solo cuando llegue HU-4.3 se confirmara si el flag `selfHealed: Boolean` alcanza para HU-4.3 CA #1 ("se marca visualmente distinto").
- **S-3**: Crear `documentacion/convenciones-modelo-de-datos.md` (entregable del Phase 4 DESIGNER que quedo pendiente). Recomendado crearlo al menos como stub en HU-0.3.
- **S-4**: La invariante "11 entidades en exploration" es laxa (regex `(i)busuario[_ ]?espacio` etc.). Es robusta para lenguaje natural pero podria romperse si alguien cambia la prosa de exploration significativamente. Considerar regex mas estricta en versiones futuras.

## Final Verdict

**PASS WITH WARNINGS**

Justificacion: Los 22/22 invariantes del script pasan. Los 9 binding decisions del Checkpoint 1+2 estan respetados en proposal.md, spec.md y design.md (Bloque 1). Los 3 criterios de aceptacion de HU-0.1 estan cubiertos en el spec. El bloque `prisma/schema.prisma` es completo, todas las FKs tienen `onDelete` explicito, los `@@unique`/`@unique` estan bien declarados, no hay metadatos de firma en `acta`, y `credencial.valor` es `Bytes @db.ByteA`. Los 3 CRITICAL y warnings se limitan a: (1) prosa sobregeneralizada sobre "@default(uuid()) en TODAS las entidades" (W-1), (2) plan de migracion aditiva pendiente para `credencial.tipo` (W-2), (3) convenciones documentales pendientes para HU-0.3 (W-3). Ninguno bloquea archive.

---

## Next recommended action

1. Checkpoint 4 manual con el usuario: mostrar este reporte + aprobar el cierre de HU-0.1.
2. Si OK, lanzar **HU-0.3** ("Scaffold + primera migración") siguiendo el plan de tasks.md en 3 PRs chained (`feature/hu0-3-scaffold-next-prisma` -> `feature/hu0-3-schema-init` -> `feature/hu0-3-cliente-tests`) con base `feature/hu0-1-modelo-de-datos-prisma` + chain strategy `feature-branch-chain`.
3. Lanzar **sdd-archive** despues de Checkpoint 4 con visto bueno manual (regla corporativa de Vorkan v2.1.0 + `openspec/config.yaml`).
