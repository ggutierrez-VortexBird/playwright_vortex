# Proposal: HU-0.2 — Convención de registro del script de Playwright

## Intent

Definir una convención documentada para que `casoPrueba.rutaScript` apunte a un archivo `.spec.ts` ejecutable por el worker **sin configuración adicional por caso**.

## Scope

### In Scope
- Formato de ruta relativa POSIX almacenado en `rutaScript`
- Estructura de directorios `espacio-slug/proyecto-slug/`
- Extensiones aceptadas (`.spec.ts` preferida, `.test.ts` aceptada)
- Estrategia de validación doble (eager en registro + lazy en ejecución)
- Resolución de ruta absoluta en el worker (`path.posix.join`)

### Out of Scope
- Implementación de UI de registro (HU-2.3)
- Código del worker executor (HU-3.1)
- Subida de archivos por UI
- `playwright.config.ts` por proyecto

## Capabilities

### New Capabilities
- `convencion-scripts-playwright`: reglas de ruta, formato, validación y resolución

### Modified Capabilities
- `modelo-de-datos-prisma`: confirma que `casoPrueba.rutaScript` almacena ruta relativa POSIX (no absoluta)

## Approach

1. **Ruta relativa POSIX** desde `PLAYWRIGHT_SCRIPTS_ROOT` (default `/app/playwright-scripts`).
2. **Estructura**: `<espacio-slug>/<proyecto-slug>/<nombre-libre>.spec.ts`.
3. **Validación eager**: `fs.access` en Server Action/API al registrar; rechazo 400 si no existe.
4. **Validación lazy**: `fs.access` en worker antes de ejecutar; `errorMotor` si falla.
5. **Resolución**: `path.posix.join(ROOT, rutaScript)` → ruta absoluta para `npx playwright test`.
6. **Sanitización**: regex rechaza `..`, leading `/`, y caracteres de control (prevención path traversal).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `documentacion/convencion-scripts-playwright.md` | New | Documento maestro de la convención |
| `openspec/specs/convencion-scripts-playwright/spec.md` | New | Delta spec con escenarios Given/When/Then |
| `casoPrueba.rutaScript` | Modified | Semántica confirmada: ruta relativa POSIX |
| `lib/script-validation.ts` | New | Utilidad de validación (fase design) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stack no instalado; no se puede probar con archivo real | High | Documentar como TODO en spec; validar en HU de scaffolding |
| Path traversal si no se sanitiza `rutaScript` | Med | Regex obligatoria en validación eager |
| Cambio de `proyecto-slug` rompe rutas almacenadas | Low | Slugs inmutables; documentar en convención |

## Rollback Plan

Trivial: eliminar `documentacion/convencion-scripts-playwright.md` y el spec creado. No hay código de producción ni migraciones de DB.

## Dependencies

- HU-0.1 (modelo de datos): debe existir `casoPrueba.rutaScript` como `String`.
- `PLAYWRIGHT_SCRIPTS_ROOT` montado como volumen en Docker (decisión confirmada en Checkpoint 1).

## Success Criteria

- [ ] Convención documentada en `documentacion/convencion-scripts-playwright.md`
- [ ] Criterio de aceptación #1 de HU-0.2 cubierto: worker puede localizar y ejecutar script sin configuración adicional
- [ ] Criterio de aceptación #2 de HU-0.2 cubierto: sistema puede detectar ruta inválida o inexistente
- [ ] Función de validación diseñada con firma clara para importación por HU-2.3 y HU-3.3
