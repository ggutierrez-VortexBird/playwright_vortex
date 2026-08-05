# Tasks: HU-0.2 — Convención de registro del script de Playwright

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Convención + firmas + Docker | PR 1 | All new files; no dependencies |

## Phase 1: Documentation

- [x] 1.1 Create `documentacion/convencion-scripts-playwright.md` with formato de ruta, ejemplos, reglas de slug inmutables y estructura de directorios

## Phase 2: TypeScript Signatures

- [x] 2.1 Create `lib/script-validation.ts` with `SCRIPT_PATH_REGEX`, `validateScriptPath()` async, and `resolveScriptPath()`
- [x] 2.2 Export `ScriptValidationResult` interface with `valid`, `absolutePath`, `error` fields

## Phase 3: Infrastructure

- [x] 3.1 Create `docker-compose.dev.yml` mounting `playwright-scripts` volume at `/app/playwright-scripts`
