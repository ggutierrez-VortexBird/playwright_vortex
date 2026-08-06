# Exploration: HU-2.3 — Registrar caso de prueba con su script de Playwright

## Current State

### Prisma schema: CasoPrueba YA EXISTE
El modelo `CasoPrueba` está completo en `prisma/schema.prisma` con todos los campos requeridos por la HU:

- `id`, `proyectoId`, `codigo`, `nombre`, `rutaScript`, `responsableId`, `activo`, `createdAt`, `updatedAt`
- `@@unique([proyectoId, codigo])` — cumple AC de unicidad por proyecto
- Relación `proyecto Proyecto @relation(... onDelete: Restrict)` — evita huérfanos
- Relación `responsable Usuario @relation("CasoPruebaResponsable", ... onDelete: Restrict)`
- Relación `ejecuciones Ejecucion[]` — para derivar estado de ejecución

### Validación de scripts YA EXISTE
`lib/script-validation.ts` provee:

- `SCRIPT_PATH_REGEX` — sanitiza ruta relativa POSIX, sin `..`, sin leading `/`, extensión `.spec.ts` o `.test.ts`
- `validateScriptPath(relativePath, options?)` — eager validation: regex + `fs.access` con mensajes descriptivos (`ENOENT`, `EACCES`)
- `resolveScriptPath(relativePath, root?)` — resolución a absoluta sin validar existencia

Convención documentada en `documentacion/convencion-scripts-playwright.md` (§6.1): doble capa eager (registro) + lazy (ejecución).

### Patrones establecidos por HU-2.1 y HU-2.2

| Capa | Patrón observado |
|------|-----------------|
| **Server Actions** | `lib/{entidad}/actions.ts` con `requireSuperadmin()`, validación manual de campos, soft-delete (`activo: false`), throws con `{ status, body }` |
| **API Routes** | `app/api/{entidad}/route.ts` (GET list, POST create) + `app/api/{entidad}/[id]/route.ts` (GET one, PUT update, DELETE soft-delete). Siempre autentican con `getSession()` y delegan a actions. |
| **Types** | `types/{entidad}.ts` con interfaces `{Entidad}`, `Create{Entidad}Input`, `Update{Entidad}Input`, y tipo enriquecido con métricas (ej: `ProyectoWithMetrics`) |
| **Pages globales** | `app/(dashboard)/{entidad}/page.tsx` Server Component que prefetcha datos y pasa a `*-client.tsx` |
| **Pages de contexto padre** | `app/(dashboard)/espacios/[id]/proyectos/page.tsx` — muestra hijos del padre con header contextual |
| **Client components** | `app/(dashboard)/{entidad}/{entidad}-client.tsx` o `components/{entidad}/*` — manejan estado local, forms, modales, hover-actions, refresh post-mutación |
| **Tests** | `__tests__/lib/{entidad}/actions.test.ts` (mock de prisma + auth) y `__tests__/app/api/{entidad}/route.test.ts` (mock de actions + auth) |

### Qué NO existe todavía para CasoPrueba

- ❌ `types/caso.ts`
- ❌ `lib/casos/actions.ts`
- ❌ `app/api/casos/route.ts` ni `[id]/route.ts`
- ❌ `app/(dashboard)/casos/page.tsx` — existe pero es placeholder vacío
- ❌ `app/(dashboard)/proyectos/[id]/casos/page.tsx` — no existe la ruta
- ❌ Ningún componente de UI para casos
- ❌ Ningún test para casos
- ❌ La tarjeta de proyecto (`ProyectoCard`) no tiene enlace "Ver casos" aún

### Gaps e inconsistencias detectadas

1. **`requireSuperadmin` no está compartido**: existe solo en `lib/proyectos/actions.ts`. `lib/espacios/actions.ts` NO verifica rol en ninguna operación (create/update/delete son públicas para cualquier usuario autenticado). HU-2.3 debe corregir esto usando un `lib/auth.ts` con `requireSuperadmin()` exportado, o al menos replicar el patrón de proyectos.

2. **No hay campo `slug` en Proyecto**: la convención de scripts (§3.1, §4) menciona `proyecto-slug` como directorio raíz de los scripts, pero el schema no tiene este campo. En el MVP la ruta del script es libre (el usuario la escribe), pero esto es un gap respecto a la convención documentada.

3. **Responsable**: actualmente solo existe el rol `superadmin`. El schema soporta múltiples usuarios vía `UsuarioEspacio`, pero la UI no tiene gestión de usuarios. Para HU-2.3 el selector de responsable puede listar todos los `Usuario` activos (solo superadmin existe hoy) o hardcodear al usuario actual.

4. **Estado "sin ejecuciones"**: no hay un campo derivado ni un helper. Se calcula en UI: si `ejecuciones.length === 0` → "sin ejecuciones".

---

## Affected Areas

| Archivo / Directorio | Por qué está afectado |
|---------------------|----------------------|
| `prisma/schema.prisma` | No requiere cambios — modelo ya completo |
| `types/caso.ts` | NUEVO — tipos para CasoPrueba, inputs, y enriquecido con estado de ejecución |
| `lib/casos/actions.ts` | NUEVO — CRUD server actions con validación de script y superadmin |
| `lib/auth.ts` | MODIFICAR — extraer `requireSuperadmin()` como utility compartida (opcional pero recomendado) |
| `app/api/casos/route.ts` | NUEVO — GET (listar por proyecto o todos) y POST (crear) |
| `app/api/casos/[id]/route.ts` | NUEVO — GET, PUT, DELETE para caso individual |
| `app/(dashboard)/casos/page.tsx` | REEMPLAZAR — de placeholder a Server Component con prefetch |
| `app/(dashboard)/casos/casos-client.tsx` | NUEVO — listado global agrupado por proyecto, con CRUD inline |
| `app/(dashboard)/proyectos/[id]/casos/page.tsx` | NUEVO — listado de casos dentro de un proyecto |
| `app/(dashboard)/proyectos/[id]/casos/caso-grid.tsx` | NUEVO — client component para interacción en contexto de proyecto |
| `components/casos/create-caso-form.tsx` | NUEVO — formulario de creación con selector de proyecto + validación de ruta |
| `components/casos/edit-caso-form.tsx` | NUEVO — formulario de edición inline |
| `components/casos/caso-row.tsx` | NUEVO — fila de caso con hover-actions (editar/eliminar) |
| `components/proyectos/proyecto-card.tsx` | MODIFICAR — agregar enlace "Ver casos" que navegue a `/proyectos/[id]/casos` |
| `lib/script-validation.ts` | No requiere cambios — se consume tal cual desde `lib/casos/actions.ts` |
| `__tests__/lib/casos/actions.test.ts` | NUEVO — tests unitarios de actions |
| `__tests__/app/api/casos/route.test.ts` | NUEVO — tests de API route |
| `__tests__/app/api/casos/[id]/route.test.ts` | NUEVO — tests de API route individual |

---

## Approaches

### Approach A: Replicar patrón Proyecto exacto (con adaptaciones)

**Descripción**: Crear `lib/casos/actions.ts`, `types/caso.ts`, API routes, pages y componentes siguiendo fielmente la estructura de `proyectos/` y `espacios/`. Validación de script se integra en `createCaso` y `updateCaso` como paso previo a Prisma. Dual-context: `/casos` global con selector de proyecto, y `/proyectos/[id]/casos` contextual.

| | |
|---|---|
| **Pros** | Máxima consistencia con codebase existente; reviewers conocen el patrón; riesgo bajo |
| **Cons** | No aprovecha Server Actions directamente desde el form (usa API routes como intermediario, igual que proyectos); un poco más de boilerplate |
| **Effort** | **Medium** |

### Approach B: Server Actions directamente desde Client Components (sin API routes)

**Descripción**: En lugar de API routes, usar Server Actions importadas directamente en los Client Components de casos (Next.js 14+ permite `'use server'` en funciones exportadas). Elimina `app/api/casos/*`.

| | |
|---|---|
| **Pros** | Menos archivos; menos indirección; patrón moderno de Next.js App Router |
| **Cons** | Rompe consistencia con proyectos/espacios (que usan API routes); requiere refactorizar el patrón de error-handling en cliente; mayor diff cognitivo para reviewers |
| **Effort** | **Medium-High** (por refactorización de patrón + riesgo de inconsistencia) |

### Approach C: API routes híbridas (lista vía API, mutaciones vía Server Action directo)

**Descripción**: Mantener API routes para GET (listar, enriquecer con estado) pero usar Server Actions directos para POST/PUT/DELETE. Es un híbrido entre A y B.

| | |
|---|---|
| **Pros** | Lista enriquecida sigue vía API (coherente con proyectos); mutaciones simplificadas |
| **Cons** | Mezcla de patrones en la misma entidad; confuso para mantenimiento |
| **Effort** | **Medium** |

---

## Recommendation

**Approach A** — replicar el patrón Proyecto exacto.

**Justificación**:

1. **Consistencia crítica**: el codebase ya tiene un patrón establecido y probado (proyectos + espacios). HU-2.3 es la tercera entidad jerárquica; los reviewers esperan el mismo layout.
2. **Riesgo bajo**: no hay que inventar arquitectura nueva. Los tests, errores, y flujos de auth son predecibles.
3. **Integración con script-validation**: el punto de inserción natural es en `createCaso` / `updateCaso`, justo antes del `prisma.casoPrueba.create/update`. Así se cumple el AC "error explícito antes de que el caso quede registrado".
4. **Dual-context**: el patrón ya se aplica en proyectos (global `/proyectos` + contextual `/espacios/[id]/proyectos`). Replicarlo para casos es mecánico.

**Decisiones específicas recomendadas**:

- Extraer `requireSuperadmin` a `lib/auth.ts` (o `lib/require-superadmin.ts`) para evitar duplicación y corregir el gap de espacios.
- El campo `responsableId` se implementa como selector de usuarios activos (lista de `prisma.usuario.findMany`). Hoy solo hay superadmin, pero el schema ya soporta multi-usuario.
- Para el estado "sin ejecuciones", crear un helper `getCasoExecutionStatus(casoId)` que devuelva `{ estado: 'sin-ejecuciones' | 'paso' | 'fallo' | 'corriendo', fechaUltimaEjecucion: Date | null }`. Se usaría tanto en `/casos` como en `/proyectos/[id]/casos`.
- La validación de script en `createCaso` debe llamar `validateScriptPath(input.rutaScript, { checkExists: true })` y, si `valid === false`, lanzar `{ status: 400, body: { error: 'validation', message: result.error } }`.
- La unicidad de código por proyecto se maneja con try/catch de Prisma P2002 (unique constraint violation) en `createCaso` y `updateCaso`, devolviendo 409 con mensaje claro.

---

## Risks

1. **Inconsistencia de auth en espacios**: si se extrae `requireSuperadmin` a shared, hay que decidir si se corrige espacios en esta HU o se deja para otra. Recomendación: corregir en esta HU para no dejar deuda.
2. **Gap de `proyecto.slug`**: la convención de scripts asume `proyecto-slug/` como prefijo de ruta, pero el schema no tiene slug. El usuario ingresará rutas libres (ej: `bancoomeva/login.spec.ts`). Esto es aceptable para MVP pero debe documentarse como known gap.
3. **Prisma P2002 handling**: si no se captura explícitamente el error de `@@unique([proyectoId, codigo])`, Prisma lanzará un error crudo. Debe envolverse en try/catch en actions.
4. **Responsable selector vacío**: si no hay usuarios además del superadmin, el selector quedará con una sola opción. Es funcional pero poco útil. No bloquea el MVP.
5. **Duplicación de lógica de listado**: `/casos` y `/proyectos/[id]/casos` necesitan casi la misma query. Se recomienda un helper compartido en `lib/casos/actions.ts` (ej: `listCasosWithStatus({ proyectoId? })`).
6. **Soft-delete de proyecto con casos activos**: el schema tiene `onDelete: Restrict` en `CasoPrueba.proyecto`, pero la UI de proyectos no valida esto antes de intentar eliminar. Esto puede causar error 500 si se intenta soft-delete de un proyecto con casos. No es scope de HU-2.3 pero es un riesgo vecino.

---

## Ready for Proposal

**Sí.**

El scope está claro, el modelo de datos ya existe, la validación de scripts ya existe, y los patrones de UI/CRUD están establecidos por HU-2.1 y HU-2.2. La implementación es mayormente mecánica (replicar patrón) con dos puntos de diseño menores:

1. Confirmar si se extrae `requireSuperadmin` a shared y se corrige espacios (recomendado: sí).
2. Confirmar si el selector de responsable lista todos los usuarios o solo el actual (recomendado: todos los usuarios activos, para alinear con el schema).

No hay blockers técnicos para pasar a PROPOSER.
