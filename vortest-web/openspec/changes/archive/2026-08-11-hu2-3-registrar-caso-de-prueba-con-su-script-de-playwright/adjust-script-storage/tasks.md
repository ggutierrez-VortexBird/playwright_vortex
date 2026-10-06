# Tasks: Ajuste HU-2.3 — Script en Base de Datos

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~600 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (ajuste sobre HU existente en misma rama) |
| Delivery strategy | Single commit sobre rama existente |

## Phase 1: Schema y Migración

- [ ] 1.1 Modificar `prisma/schema.prisma`: eliminar `rutaScript`, agregar `script` (Text) y `scriptFileName` (String?)
- [ ] 1.2 Generar migración Prisma: `npx prisma migrate dev --name script_to_db`
- [ ] 1.3 Crear `scripts/migrate-scripts-to-db.ts`: leer archivos del disco y migrar contenido a BD
- [ ] 1.4 Ejecutar script de migración de datos
- [ ] 1.5 Generar segunda migración para eliminar `rutaScript` (o hacerlo en una sola con SQL manual)
- [ ] 1.6 Ejecutar `prisma generate`

## Phase 2: Backend — Eliminación y Adaptación

- [ ] 2.1 Eliminar `lib/script-validation.ts`
- [ ] 2.2 Eliminar `app/api/scripts/route.ts`
- [ ] 2.3 Actualizar `types/caso.ts`: reemplazar `rutaScript` por `script` + `scriptFileName`
- [ ] 2.4 Actualizar `lib/casos/actions.ts`:
  - Eliminar import de `validateScriptPath`
  - Cambiar `rutaScript` → `script` en todas las funciones
  - Agregar validación de script no vacío
  - Agregar `scriptFileName` a `CasoPruebaFormData`
- [ ] 2.5 Actualizar `app/api/casos/route.ts`:
  - Cambiar POST para aceptar `multipart/form-data`
  - Extraer `File` de `formData`, validar extensión
  - Leer contenido con `.text()`
  - Llamar `createCaso` con `script` y `scriptFileName`
- [ ] 2.6 Actualizar `app/api/casos/[id]/route.ts`:
  - Cambiar PUT para aceptar `multipart/form-data`
  - Manejar caso donde `scriptFile` no está presente (conservar existente)

## Phase 3: Frontend — Componentes

- [ ] 3.1 Crear `components/casos/script-file-input.tsx`:
  - `<input type="file" accept=".spec.ts,.test.ts">`
  - Modo edición: mostrar nombre actual + botón reemplazar
  - Callback `onChange(file: File | null)`
- [ ] 3.2 Eliminar `components/casos/script-select.tsx`
- [ ] 3.3 Actualizar `components/casos/create-caso-form.tsx`:
  - Reemplazar `ScriptSelect` por `ScriptFileInput`
  - Cambiar estado `rutaScript: string` → `scriptFile: File | null`
  - Adaptar `handleSubmit` a `FormData`
  - Eliminar `Content-Type` header (fetch maneja FormData automáticamente)
- [ ] 3.4 Actualizar `components/casos/edit-caso-form.tsx`:
  - Reemplazar `ScriptSelect` por `ScriptFileInput`
  - Pasar `scriptFileName` actual al input
  - En submit, solo incluir `scriptFile` en FormData si hay archivo nuevo
- [ ] 3.5 Actualizar `components/casos/caso-table.tsx`:
  - Cambiar columna script para mostrar `scriptFileName` en vez de `rutaScript`

## Phase 4: Testing

- [ ] 4.1 Actualizar `e2e/casos.spec.ts`:
  - Reemplazar `page.fill('input[id="rutaScript"]')` por `page.setInputFiles()`
  - Actualizar assertions para verificar `scriptFileName` en tabla
- [ ] 4.2 Actualizar tests de integración de `/api/casos` (si existen)
- [ ] 4.3 Actualizar tests unitarios de `lib/casos/actions.ts` (si existen)

## Phase 5: Limpieza y Verificación

- [ ] 5.1 Buscar y eliminar todas las referencias a `rutaScript` en el codebase
- [ ] 5.2 Verificar que `app/api/scripts` no tenga imports rotos
- [ ] 5.3 Correr `npm run build` para verificar compilación
- [ ] 5.4 Correr `npx prisma generate` y verificar tipos
- [ ] 5.5 Correr tests E2E: `npx playwright test e2e/casos.spec.ts`
- [ ] 5.6 Revisión adversarial (VERIFIER)
