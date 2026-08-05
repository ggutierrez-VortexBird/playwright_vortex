# Design: HU-0.2 — Convención de registro del script de Playwright

## Technical Approach

Documentar una convención vinculante para `casoPrueba.rutaScript` que permita al worker localizar y ejecutar scripts sin configuración adicional por caso. La entrega son **documentos vivos** (convención maestra) y **firmas TypeScript** (`lib/script-validation.ts`) que las HUs de Fase 2 y 3 importarán. No se escribe código ejecutable de producción: el stack aún no está instalado.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Root de scripts | Env var `PLAYWRIGHT_SCRIPTS_ROOT` vs. hardcoded | Hardcoded rompe portabilidad; env var permite dev/prod distintos | Env var con default `/app/playwright-scripts` |
| Estructura de directorios | `proyecto-slug/` vs. `espacio-slug/proyecto-slug/` | Espacio evita colisiones; proyecto simplifica MVP | **MVP**: `proyecto-slug/<nombre>.spec.ts`; espacio como extensión futura (revisado en Checkpoint 2) |
| Resolución de ruta | `path.resolve` vs. `path.posix.join` | `resolve` puede absorber `..`; `posix.join` coherente con Linux runtime | `path.posix.join(ROOT, rutaScript)` |
| Validación | Eager único vs. eager+lazy | Doble capa detecta roturas entre registro y ejecución | Eager (registro) + lazy (worker) |
| Sanitización | Regex previa vs. `path.normalize` | `normalize` no detecta intención maliciosa; regex rechaza antes de tocar disco | Regex obligatoria antes de `fs.access` |

## Data Flow

```
Registro (HU-2.3)          Ejecución (HU-3.1)
     │                            │
     ▼                            ▼
validateScriptPath()        resolveScriptPath()
     │                            │
     ├── regex: no .. /          └── path.posix.join()
     │    leading / / ctrl        └── fs.access()
     ├── extension .spec.ts           │
     └── fs.access()                  ▼
     │                         npx playwright test <abs>
     ▼
  400 OK / error
```

## File Changes

| File | Action | Description |
|---|---|---|
| `documentacion/convencion-scripts-playwright.md` | Create | Documento maestro: formato, ejemplos, reglas de slug inmutables |
| `lib/script-validation.ts` | Create | Firmas de `validateScriptPath` y `resolveScriptPath` |
| `docker-compose.dev.yml` | Create | Volumen `playwright-scripts` montado en `/app/playwright-scripts` |
| `openspec/changes/.../design/design.md` | Create | Este documento |

## Interfaces / Contracts

```typescript
// lib/script-validation.ts

const SCRIPT_PATH_REGEX = /^(?!\/)(?!.*\.\.)(?!.*[\x00-\x1f])[\w./-]+\.(spec|test)\.ts$/;

export interface ScriptValidationResult {
  valid: boolean;
  absolutePath?: string;
  error?: string;
}

/**
 * Valida formato, seguridad y existencia de un script.
 * Llama a fs.access si la sanitización pasa.
 */
export async function validateScriptPath(
  relativePath: string,
  options?: { root?: string; checkExists?: boolean }
): Promise<ScriptValidationResult>;

/**
 * Resuelve ruta relativa a absoluta sin validar existencia.
 */
export function resolveScriptPath(
  relativePath: string,
  root?: string
): string;
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Regex: acepta `.spec.ts`, rechaza `..`, `/`, control chars, `.js` | Vitest (instalar en Fase 1) |
| Unit | `resolveScriptPath` con trailing/leading slashes | Vitest |
| Integration | `validateScriptPath` con `fs.access` mock (existe vs. ENOENT) | Vitest + memfs |
| E2E | No aplica — sin stack instalado | — |

## Migration / Rollout

No migration required. Rollback trivial: eliminar `documentacion/convencion-scripts-playwright.md` y `lib/script-validation.ts`.

## Open Questions

- ¿Se incluye `espacio-slug/` en la ruta antes del MVP? **Decisión**: no, extensión futura.
- ¿Validación de contenido mínimo (`test(`) en eager? **Decisión**: no en MVP; solo existe + extensión.
