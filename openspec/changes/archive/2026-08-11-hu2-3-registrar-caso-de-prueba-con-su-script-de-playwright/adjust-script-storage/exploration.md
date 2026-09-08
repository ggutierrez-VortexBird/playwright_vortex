# Exploration: Ajuste HU-2.3 — Script en Base de Datos

## Contexto

La HU-2.3 "Registrar caso de prueba con su script de Playwright" fue implementada guardando `rutaScript` como un string que apunta a un archivo en el filesystem del servidor (`PLAYWRIGHT_SCRIPTS_ROOT/{proyectoId}/`). El usuario selecciona el script mediante un `<select>` que lista los archivos `.spec.ts` / `.test.ts` existentes en el directorio del proyecto.

## Gap Identificado

El usuario solicita un cambio de arquitectura:
1. **Selección de archivo**: Cambiar de `<select>` (lista archivos del servidor) a `<input type="file">` (sube archivo desde la máquina del usuario).
2. **Almacenamiento**: Cambiar de guardar la ruta en filesystem a guardar el **contenido del archivo** en la base de datos.
3. **Ejecución**: El motor de ejecución (HU-3.1) debe poder leer el script desde la BD y ejecutarlo.

## Estado Actual del Código

| Componente | Estado | Notas |
|---|---|---|
| `prisma/schema.prisma` | `CasoPrueba.rutaScript: String` | Debe migrarse a `script: String @db.Text` |
| `lib/script-validation.ts` | Valida path en filesystem con regex + fs.access | **Eliminar** — ya no aplica |
| `app/api/scripts/route.ts` | Lista archivos del disco | **Eliminar** — ya no aplica |
| `components/casos/script-select.tsx` | `<select>` con opciones del servidor | **Eliminar** — reemplazar por file input |
| `components/casos/create-caso-form.tsx` | Usa `ScriptSelect`, envía JSON | Adaptar a `FormData` + file input |
| `components/casos/edit-caso-form.tsx` | Usa `ScriptSelect`, envía JSON | Adaptar a `FormData` + file input |
| `lib/casos/actions.ts` | Valida `rutaScript` con `validateScriptPath` | Adaptar a validación de contenido/extensión |
| `app/api/casos/route.ts` | Recibe JSON, llama `createCaso` | Adaptar a `FormData` + lectura de `File` |
| `app/api/casos/[id]/route.ts` | Recibe JSON, llama `updateCaso` | Adaptar a `FormData` + lectura de `File` |
| `e2e/casos.spec.ts` | Usa `page.fill('input[id="rutaScript"]')` | Adaptar a `page.setInputFiles()` |
| Datos existentes | `rutaScript` apunta a archivos en disco | Migrar contenido de archivos a `script` en BD |

## Decisiones del Usuario

1. **¿Guardar en BD?** Sí. El script se almacena en la base de datos para asegurar su ejecución posterior.
2. **¿Directorio o BD?** En BD, no en directorio del servidor.
3. **¿Mantener select o usar file input?** Decisión del implementador: usar `<input type="file">` con `accept=".spec.ts,.test.ts"`. Eliminar completamente el `<select>` y el endpoint `/api/scripts`.
4. **¿Validación de contenido?** Extensión del archivo (`.spec.ts` / `.test.ts`) es suficiente por ahora.

## Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Pérdida de datos durante migración | Alto | Script de migración lee archivos del disco; si no existe, se deja vacío (se puede re-subir desde UI) |
| Tamaño de scripts en BD | Medio | PostgreSQL `TEXT` soporta hasta 1GB; scripts Playwright típicamente < 100KB |
| Cambio de contrato API (JSON → FormData) | Medio | Actualizar todos los consumidores (create form, edit form, tests) |
| Break de ejecución futura (HU-3.1) | Medio | El motor de ejecución debe leer desde `casoPrueba.script` en vez de filesystem. Documentar en diseño. |

## Alcance del Ajuste

### In Scope
- Migración de schema Prisma (`rutaScript` → `script`)
- Script de migración de datos (filesystem → BD)
- Eliminación de `lib/script-validation.ts`
- Eliminación de `app/api/scripts/route.ts`
- Eliminación de `components/casos/script-select.tsx`
- Creación de `components/casos/script-file-input.tsx`
- Adaptación de `create-caso-form.tsx` y `edit-caso-form.tsx` a `FormData`
- Adaptación de `app/api/casos/route.ts` y `[id]/route.ts` a `FormData`
- Adaptación de `lib/casos/actions.ts` a validación de contenido
- Actualización de `e2e/casos.spec.ts`
- Actualización de tests de integración

### Out of Scope
- Cambios al motor de ejecución (HU-3.1) — solo se documenta el nuevo contrato
- UI de visualización del contenido del script (preview) — se puede agregar en HU futura
- Validación de sintaxis Playwright en el contenido del archivo

## Notas

Este ajuste convierte a ACTA en una aplicación "self-contained" donde los scripts de prueba viven completamente en la base de datos, eliminando la dependencia de un filesystem compartido entre la aplicación web y el motor de ejecución. Esto simplifica el deployment y garantiza que el script siempre esté disponible cuando se necesite ejecutar.
