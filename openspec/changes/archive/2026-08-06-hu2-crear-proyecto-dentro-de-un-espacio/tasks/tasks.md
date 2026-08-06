# Tasks: HU-2.2 — Crear proyecto dentro de un espacio

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800-1000 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Tasks

### 1. Foundation / Types
**Responsible:** types
**Tests:** none

#### 1.1 Create `types/proyecto.ts`
- [x] Create `types/proyecto.ts` with `Proyecto`, `CreateProyectoInput`, `UpdateProyectoInput`, `ProyectoWithMetrics` interfaces
- [x] `versionSistema` is internal — NOT exposed in API types

---

### 2. Unit Tests — RED (TDD)
**Responsible:** unit
**Tests:** `__tests__/lib/proyectos/actions.test.ts`

#### 2.1 Write tests for `createProyecto`
- [x] Test throws 400 when `nombre` missing/empty
- [x] Test throws 400 when `ambiente` missing/empty
- [x] Test throws 400 when `espacioId` missing
- [x] Test throws 403 when user is not superadmin
- [x] Test creates proyecto and returns it on valid input
- [x] Test throws 404 when espacio does not exist

#### 2.2 Write tests for `listProyectosByEspacio`
- [x] Test returns only proyectos from specified espacioId
- [x] Test returns empty array when no proyectos exist

#### 2.3 Write tests for `getProyectoById`
- [x] Test returns proyecto with metrics (totalCasos, casosConformes, casosNoConformes, fechaUltimaEjecucion)
- [x] Test throws 404 when proyecto not found

#### 2.4 Write tests for `updateProyecto`
- [x] Test throws 403 when user is not superadmin
- [x] Test throws 404 when proyecto not found
- [x] Test updates only provided fields (nombre, ambiente)

#### 2.5 Write tests for `deleteProyecto`
- [x] Test throws 403 when user is not superadmin
- [x] Test throws 404 when proyecto not found
- [x] Test sets `activo: false` (soft delete)

#### 2.6 Write tests for `getMetrics`
- [x] Test returns correct totalCasos count
- [x] Test returns correct casosConformes from latest execution per caso
- [x] Test returns correct casosNoConformes from latest execution per caso
- [x] Test returns null fechaUltimaEjecucion when no executions exist
- [x] Test returns 0 counts when proyecto has no casos

#### 2.7 Write tests for `requireSuperadmin`
- [x] Test throws `{ status: 403 }` when user.rol !== 'superadmin'
- [x] Test does not throw when user.rol === 'superadmin'

---

### 3. Actions Implementation — GREEN
**Responsible:** unit
**Tests:** `__tests__/lib/proyectos/actions.test.ts`

#### 3.1 Implement `lib/proyectos/actions.ts`
- [x] Implement `requireSuperadmin(session)` helper
- [x] Implement `createProyecto(input, session)` with validation and superadmin check
- [x] Implement `listProyectosByEspacio(espacioId)` with proyecto list
- [x] Implement `getProyectoById(id)` with metrics aggregation (3-query strategy per design)
- [x] Implement `updateProyecto(id, input, session)` with validation and superadmin check
- [x] Implement `deleteProyecto(id, session)` with soft delete and superadmin check
- [x] Implement `getMetrics(proyectoId)` using 3-query strategy (casos→groupBy→estados)

#### 3.2 Modify `lib/espacios/actions.ts` — add 409 for delete espacio
- [x] In `deleteEspacio(id)`, check if any active proyectos exist for this espacioId before soft delete
- [x] If proyectos activos exist, throw `{ status: 409, body: { error: "conflict", message: "hay proyectos activos" } }`

---

### 4. Integration Tests — RED (TDD)
**Responsible:** integration
**Tests:** `__tests__/app/api/proyectos/route.test.ts`, `__tests__/app/api/proyectos/[id]/route.test.ts`

#### 4.1 Write tests for `POST /api/proyectos/`
- [x] Test returns 201 with created proyecto on valid input
- [x] Test returns 400 when validation fails
- [x] Test returns 403 when not superadmin
- [x] Test returns 401 when not authenticated

#### 4.2 Write tests for `GET /api/proyectos/?espacioId=X`
- [x] Test returns 200 with array of proyectos with metrics
- [x] Test returns only proyectos from specified espacioId
- [x] Test returns 400 when espacioId is missing

#### 4.3 Write tests for `GET /api/proyectos/[id]/`
- [x] Test returns 200 with proyecto and metrics
- [x] Test returns 404 when proyecto not found

#### 4.4 Write tests for `PUT /api/proyectos/[id]/`
- [x] Test returns 200 with updated proyecto
- [x] Test returns 400 when validation fails
- [x] Test returns 403 when not superadmin
- [x] Test returns 404 when proyecto not found

#### 4.5 Write tests for `DELETE /api/proyectos/[id]/`
- [x] Test returns 204 on success
- [x] Test returns 403 when not superadmin
- [x] Test returns 404 when proyecto not found

#### 4.6 Write tests for `DELETE /api/espacios/[id]/` (modified)
- [x] Test returns 409 when espacio has active proyectos
- [x] Test returns 204 when espacio has no proyectos

---

### 5. API Routes Implementation — GREEN
**Responsible:** integration
**Tests:** `__tests__/app/api/proyectos/route.test.ts`, `__tests__/app/api/proyectos/[id]/route.test.ts`

#### 5.1 Create `app/api/proyectos/route.ts`
- [x] Implement `GET` handler — calls `listProyectosByEspacio`, returns 200 with `{ proyectos: [...] }`
- [x] Implement `POST` handler — validates body, calls `createProyecto`, returns 201 with created proyecto

#### 5.2 Create `app/api/proyectos/[id]/route.ts`
- [x] Implement `GET` handler — calls `getProyectoById`, returns 200 or 404
- [x] Implement `PUT` handler — validates body, calls `updateProyecto`, returns 200 or error
- [x] Implement `DELETE` handler — calls `deleteProyecto`, returns 204 or error

#### 5.3 Modify `app/api/espacios/[id]/route.ts`
- [x] In `DELETE` handler, catch 409 from `deleteEspacio` and return 409 to client

---

### 6. UI Components
**Responsible:** e2e
**Tests:** `e2e/proyectos.spec.ts`

#### 6.1 Create `components/proyectos/proyecto-card.tsx`
- [x] Create client component with hooks: `useRouter`
- [x] Display: chip de espacio, nombre, ambiente, totalCasos, casosConformes, casosNoConformes, fechaUltimaEjecucion
- [x] Implement hover states and action buttons (edit, delete)

#### 6.2 Create `app/(dashboard)/espacios/[id]/proyectos/page.tsx`
- [x] Create RSC (async) that fetches proyectos data with `next.revalidate: 0`
- [x] Wrap with `<Suspense fallback={<Skeleton/>}>`
- [x] Render `<ProyectoGrid>` client component
- [x] Include `<ProyectoCard>` for each proyecto

---

### 7. E2E Tests
**Responsible:** e2e
**Tests:** `e2e/proyectos.spec.ts`

#### 7.1 Create `e2e/proyectos.spec.ts`
- [x] Test: superadmin creates proyecto → 201 → card appears in grid
- [x] Test: non-superadmin cannot see create button
- [x] Test: clicking card shows proyecto detail
- [x] Test: superadmin can edit proyecto
- [x] Test: superadmin can delete proyecto → card disappears
- [x] Test: deleting espacio with proyectos returns 409

---

## Implementation Order

1. **Types** (`types/proyecto.ts`) — no dependencies, foundation
2. **Unit tests RED** — write all tests for actions
3. **Actions GREEN** — implement `lib/proyectos/actions.ts` + modify `lib/espacios/actions.ts`
4. **Integration tests RED** — write tests for API routes
5. **API routes GREEN** — implement `app/api/proyectos/route.ts` + `app/api/proyectos/[id]/route.ts` + modify espacios route
6. **UI components** — create card and page
7. **E2E tests** — full flow verification

## Notes

- `versionSistema` is internal — do NOT expose in API responses (per exploration decision)
- 409 check in delete espacio modifies existing `lib/espacios/actions.ts` and `app/api/espacios/[id]/route.ts`
- Metrics use 3-query strategy (no N+1, no raw SQL)
- Soft delete for proyectos (`activo: false`) matches existing deleteEspacio pattern
