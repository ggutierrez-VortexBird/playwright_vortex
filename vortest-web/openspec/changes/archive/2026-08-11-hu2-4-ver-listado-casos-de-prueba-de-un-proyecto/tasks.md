# Tasks: HU-2.4 — Ver listado de casos con pasos y hover-to-reveal

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100-150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Decision needed before apply | No |

## Phase 1: Type Definition

- [x] 1.1 Add `pasosCount: number | null` to `CasoPruebaListItem` in `types/caso.ts`

## Phase 2: Core Implementation

- [x] 2.1 Modify `listCasos()` in `lib/casos/actions.ts` to include `pasos` in latest Ejecucion query with `take: 1`
- [x] 2.2 Compute `pasosCount` from `latestEjecucion?.pasos.length ?? null` in mapper

## Phase 3: UI Enhancement

- [x] 3.1 Add "Pasos" column to `CasoTable` in `components/casos/caso-table.tsx`
- [x] 3.2 Implement hover-to-reveal for Edit/Eliminar buttons using `invisible group-hover:visible`
- [x] 3.3 Add `@media (hover: none)` mobile fallback to keep buttons visible on touch devices

## Phase 4: Testing

- [x] 4.1 Fix `__tests__/lib/casos/actions.test.ts` mocks to include `pasos` in `ejecuciones`
- [x] 4.2 Add `pasosCount` to `mockCasos` in `__tests__/components/casos/caso-table.test.tsx`
- [x] 4.3 Verify all 6 scenarios pass

## Summary

| # | File | Change |
|---|------|--------|
| 1 | `types/caso.ts` | Add `pasosCount` field |
| 2 | `lib/casos/actions.ts` | Include pasos in query, compute count |
| 3 | `components/casos/caso-table.tsx` | Column + hover CSS |
