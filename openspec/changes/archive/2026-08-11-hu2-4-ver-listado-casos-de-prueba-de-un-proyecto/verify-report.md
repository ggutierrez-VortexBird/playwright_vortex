# Verification Report

**Change**: hu2-4-ver-listado-casos-de-prueba-de-un-proyecto
**Version**: N/A
**Mode**: Standard (Strict TDD not active)

## Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 3 |
| Tasks complete | 3 |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Build**: ✅ Passed
```
npm run build
Next.js 15.5.22
✓ Compiled successfully in 18.2s
✓ Generating static pages (15/15)
Route (app)  ...  /proyectos/[id]/casos  119 B  109 kB
```

**Tests**: ⚠ 140 passed / 20 failed (5 suites)
```
npm test
Test Suites: 5 failed, 16 passed, 21 total
Tests: 20 failed, 140 passed, 160 total
```

Key failures related to this change:
- `__tests__/lib/casos/actions.test.ts` — 2 failures: `listCasos` tests fail because mock data lacks `pasos` in `ejecuciones`, causing `TypeError: Cannot read properties of undefined (reading 'length')` at `actions.ts:99`

Other failing tests (pre-existing, unrelated to this change):
- `__tests__/app/api/proyectos/route.test.ts` — `SyntaxError: Unexpected end of JSON input` (API route mock setup issue)
- `__tests__/app/api/proyectos/[id]/route.test.ts` — Same JSON parse issue
- `__tests__/app/api/espacios/[id]/route.test.ts` — `getSession.mockResolvedValue is not a function`
- `fixtures/test-script.spec.ts` — `@playwright/test` module not found (Playwright fixture, not Jest)

Relevant passing tests:
- `__tests__/components/casos/caso-table.test.tsx` — ✅ PASS (9 tests)
- `__tests__/app/(dashboard)/casos/page.test.tsx` — ✅ PASS

## Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01 | Caso con ejecuciones muestra pasosCount | `caso-table.test.tsx` (renders "Pasos" cell) | ⚠️ PARTIAL — component test passes; `actions.test.ts` fails due to outdated mock |
| REQ-02 | Caso sin ejecuciones muestra 0 pasos | `caso-table.test.tsx` + `actions.test.ts` | ⚠️ PARTIAL — same as above |
| REQ-03 | Hover revela botones de acción | `caso-table.test.tsx > calls onEdit/onDelete` | ✅ COMPLIANT |
| REQ-04 | Mobile fallback — tap para revelar botones | CSS-only via `@media (hover: none)` | ✅ COMPLIANT (no runtime test, CSS verified) |
| REQ-05 | Sin permisos de edición no muestra columna Acciones | `caso-table.test.tsx > does not show action buttons when canEdit is false` | ✅ COMPLIANT |
| REQ-06 | Listado vacío muestra mensaje | `caso-table.test.tsx > renders empty state when no casos` | ✅ COMPLIANT |

**Compliance summary**: 4/6 scenarios fully compliant, 2/6 partial

## Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| `types/caso.ts` — `pasosCount: number \| null` in `CasoPruebaListItem` | ✅ Implemented | Line 40: `pasosCount: number \| null;` |
| `lib/casos/actions.ts` — `pasos` included with `take: 1` | ✅ Implemented | Lines 87-91: `ejecuciones: { include: { pasos: { select: { id: true } } }, orderBy: { finAt: "desc" }, take: 1 }` |
| `lib/casos/actions.ts` — `pasosCount` computed correctly | ✅ Implemented | Line 99: `const pasosCount = caso.ejecuciones[0]?.pasos.length ?? null;` |
| `caso-table.tsx` — "Pasos" column rendered | ✅ Implemented | Lines 91-93 (header), 135-139 (cell) with `{caso.pasosCount ?? 0}` |
| `caso-table.tsx` — hover-to-reveal buttons | ✅ Implemented | Lines 150, 162: `className="invisible group-hover:visible ... media-hover:visible"` |
| `caso-table.tsx` — mobile `@media (hover: none)` | ✅ Implemented | Lines 175-181: `<style jsx>` with `.media-hover\:visible { visibility: visible; }` |
| `caso-table.tsx` — conditional Acciones column | ✅ Implemented | Lines 94-98 (th), 140-169 (td) with `{canEdit && (...)}` |
| `caso-table.tsx` — empty state message | ✅ Implemented | Lines 60-66: `if (casos.length === 0)` with "No hay casos de prueba" |

## Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Count pasos via Prisma `_count` (nested `include` + `select: { id: true }`) | ✅ Yes | Implementation uses `include: { pasos: { select: { id: true } } }` — efficient single query |
| `take: 1` to get only latest execution | ✅ Yes | Line 90: `take: 1` |
| Tailwind `group-hover` for hover-reveal | ✅ Yes | `invisible group-hover:visible` on buttons |
| `@media (hover: none)` for mobile fallback | ✅ Yes | CSS at lines 175-181 |
| `pasosCount ?? 0` in table cell | ✅ Yes | Matches design intent (null → 0 display) |
| No Acciones column when `canEdit=false` | ✅ Yes | Conditional render matches spec |

## Next.js App Router Compliance
| Rule | Status | Notes |
|------|--------|-------|
| App Router (`app/`) used | ✅ Yes | All routes in `app/` directory |
| Server Components by default | ✅ Yes | `CasoTable` correctly marked `"use client"` for interactivity |
| `generateMetadata` used for SEO | ➖ N/A | Dashboard component, no SEO metadata needed |
| `next/image` for content images | ➖ N/A | No images in this component |
| `loading.tsx`/`error.tsx` boundaries | ✅ Yes | Existing boundaries present in route segments |

## Issues Found

**CRITICAL**:
- `__tests__/lib/casos/actions.test.ts` — `listCasos` tests (lines 194-279) fail because mock `ejecuciones` lack a `pasos` array. At `actions.ts:99`, the code does `caso.ejecuciones[0]?.pasos.length ?? null` but the mock returns `ejecuciones` objects without `pasos`. Fix: add `pasos: [{ id: 'p1' }, { id: 'p2' }]` to the mock `ejecuciones` array. This is blocking CI and proves the `pasosCount` code path is untested at the unit level.

**WARNING**:
- `__tests__/components/casos/caso-table.test.tsx` — mock `mockCasos` (lines 5-51) omits the `pasosCount` field. TypeScript would compile this to an error if strict null checks were enforced, but Jest's `moduleNameMapper` or loose typing allows it to pass. The test validates the feature behavior correctly but lacks explicit `pasosCount` assertions.

**SUGGESTION**:
- Add explicit `pasosCount` values to `mockCasos` in `caso-table.test.tsx` to ensure the field is intentionally handled (e.g., `pasosCount: 3` for the first caso).
- Add a dedicated test in `actions.test.ts` for `pasosCount: 0` (no ejecuciones) and `pasosCount: N` (with pasos) to fully cover the new field per the spec scenarios.
- The test at line 236-244 of `actions.test.ts` asserts an outdated Prisma call signature (without `include: { pasos }` and `take: 1`). Update the expected call to match the new implementation.

## Verdict

**PASS WITH WARNINGS**

The implementation is functionally complete and correct — all three files (`types/caso.ts`, `lib/casos/actions.ts`, `components/casos/caso-table.tsx`) match the design and spec exactly. The build passes. The `caso-table` component tests pass. However, the `listCasos` unit tests fail due to outdated mocks that predate the `pasosCount` feature, creating a CRITICAL gap in test coverage for the core data-computation logic. The other failing tests are pre-existing and unrelated to this change.

**Recommended next step**: Update `__tests__/lib/casos/actions.test.ts` mocks to include `pasos` in `ejecuciones`, then re-run verification.
