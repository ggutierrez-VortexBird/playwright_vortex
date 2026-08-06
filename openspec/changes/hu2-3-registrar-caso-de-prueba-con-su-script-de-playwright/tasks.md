# Tasks: Registrar caso de prueba con su script de Playwright

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + Backend → PR 2: UI Components → PR 3: Tests |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

## Phase 1: Foundation

- [ ] 1.1 Create `types/caso.ts` with `CasoPrueba`, `CasoPruebaFormData`
- [ ] 1.2 Add `requireSuperadmin` to `lib/auth.ts`; refactor `lib/proyectos/actions.ts` to import it
- [ ] 1.3 Add `requireSuperadmin` to `lib/espacios/actions.ts` create/update/delete

## Phase 2: Core Implementation

- [ ] 2.1 Create `lib/casos/actions.ts`: `createCaso`, `updateCaso`, `deleteCaso`, `getCasoById`, `listCasos` with P2002→409
- [ ] 2.2 Create `app/api/usuarios/route.ts` GET (superadmin-only) for responsable selector
- [ ] 2.3 Create `app/api/casos/route.ts`: GET (list/filter), POST with eager `validateScriptPath`
- [ ] 2.4 Create `app/api/casos/[id]/route.ts`: GET, PUT with validation, DELETE soft-delete

## Phase 3: Integration / Wiring

- [ ] 3.1 Create `components/casos/caso-table.tsx` reusing mockup styles
- [ ] 3.2 Create `components/casos/responsable-select.tsx` fetching `/api/usuarios`
- [ ] 3.3 Create `components/casos/create-caso-form.tsx` with script validation
- [ ] 3.4 Create `components/casos/edit-caso-form.tsx`
- [ ] 3.5 Create `app/(dashboard)/casos/page.tsx` + `casos-client.tsx` global view
- [ ] 3.6 Create `app/(dashboard)/proyectos/[id]/casos/page.tsx` contextual view
- [ ] 3.7 Modify `components/proyectos/proyecto-card.tsx` linking to project cases tab

## Phase 4: Testing

- [ ] 4.1 Unit test: `requireSuperadmin` returns 403 for non-superadmin
- [ ] 4.2 Unit test: `validateScriptPath` rejects invalid paths with 400
- [ ] 4.3 Unit test: P2002 caught and translated to 409
- [ ] 4.4 Integration test: POST `/api/casos` full flow (create, duplicate, invalid script)
- [ ] 4.5 Integration test: GET `/api/casos` dual-context filters
- [ ] 4.6 E2E test: Superadmin creates caso via UI
