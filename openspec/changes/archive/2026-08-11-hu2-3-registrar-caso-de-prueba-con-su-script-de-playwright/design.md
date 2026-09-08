# Design: Registrar caso de prueba con su script de Playwright

## Technical Approach

Replicate the `gestion-proyectos` pattern: shared types, Server Actions for mutations, API routes for queries, server-component pages with `loading.tsx`/`error.tsx`, and reusable client components. Add eager `rutaScript` validation via `lib/script-validation.ts`, unique-code enforcement per proyecto, and a dual-context UI (global `/casos` and contextual `/proyectos/[id]/casos`). Extract `requireSuperadmin` to `lib/auth.ts` and wire it into all protected Server Actions.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Script validation | Eager in `createCaso`/`updateCaso` before Prisma write | Lazy at execution time | Fails fast at registration; avoids broken references in the test catalog |
| Duplicate code handling | Catch Prisma `P2002`, translate to `409` | Application-level pre-check | Single source of truth is the DB unique constraint; avoids race conditions |
| Dual-context UI | Separate pages: `/casos` (grouped table) and `/proyectos/[id]/casos` (filtered table) | Single page with query param toggle | Matches existing global vs contextual pattern (`/proyectos` vs `/espacios/[id]/proyectos`) |
| Auth utility | Extract `requireSuperadmin` to `lib/auth.ts` | Inline in every action file | Eliminates duplication; centralizes role-check logic; fixes missing auth in espacios actions |
| Caso status field | Computed on read, not stored | Stored enum column | Status derives from latest `ejecucion`; storing it would require sync on every execution update |
| Responsable selector | Fetch all `Usuario` rows (no `activo` flag in schema) | Add `activo` to `Usuario` | Schema is frozen for this change; all users are implicitly active in the current model |

## Data Flow

```
Usuario (superadmin)
    │ POST/PUT/DELETE /api/casos/*
    ▼
API Route (route.ts)
    │ calls
    ▼
Server Action (lib/casos/actions.ts)
    ├─→ requireSuperadmin(session) ──→ lib/auth.ts
    ├─→ validateScriptPath(rutaScript) ──→ lib/script-validation.ts
    ├─→ prisma.casoPrueba.create/update ──→ Postgres
    └─→ P2002 caught → 409 Conflict
    │
    ▼
GET /api/casos?proyectoId=X
    │
    ▼
Server Component (page.tsx)
    ├─→ fetch /api/casos
    └─→ pass to CasosClient (table + filters)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `types/caso.ts` | Create | `CasoPrueba`, `CasoPruebaFormData`, `CasoPruebaListItem` types |
| `lib/auth.ts` | Modify | Add `requireSuperadmin(session)`; remove from `lib/proyectos/actions.ts` |
| `lib/proyectos/actions.ts` | Modify | Import `requireSuperadmin` from `lib/auth.ts` |
| `lib/espacios/actions.ts` | Modify | Add `requireSuperadmin` to `createEspacio`, `updateEspacio`, `deleteEspacio` |
| `lib/casos/actions.ts` | Create | `createCaso`, `updateCaso`, `deleteCaso`, `listCasos`, `getCasoById` |
| `app/api/casos/route.ts` | Create | `GET` (list, optional `proyectoId` filter), `POST` (create) |
| `app/api/casos/[id]/route.ts` | Create | `GET`, `PUT`, `DELETE` by id |
| `app/(dashboard)/casos/page.tsx` | Create | Global list server component; groups casos by proyecto |
| `app/(dashboard)/casos/casos-client.tsx` | Create | Client table with filters and modals |
| `app/(dashboard)/proyectos/[id]/casos/page.tsx` | Create | Contextual list filtered by `proyectoId` |
| `components/casos/create-caso-form.tsx` | Create | Form with codigo, nombre, rutaScript, responsable selector, proyectoId hidden/pre-filled |
| `components/casos/edit-caso-form.tsx` | Create | Inline edit form; reuses create layout |
| `components/casos/caso-table.tsx` | Create | Table component reusing mockup styles (`table`, `pill`, `tname`, `tmeta`) |
| `components/casos/responsable-select.tsx` | Create | Dropdown fetching all users from `/api/usuarios` |
| `components/proyectos/proyecto-card.tsx` | Modify | Add link to `/proyectos/[id]/casos` tab |
| `app/api/usuarios/route.ts` | Create | `GET` all users for responsable selector |

## Interfaces / Contracts

```typescript
// types/caso.ts
export interface CasoPrueba {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  rutaScript: string;
  responsableId: string;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CasoPruebaFormData {
  codigo: string;
  nombre: string;
  rutaScript: string;
  responsableId: string;
  proyectoId: string;
}
```

**API Contracts**
- `POST /api/casos` → `201` + `CasoPrueba` (estado computed as `"sin ejecuciones"`)
- `POST /api/casos` duplicate → `409` `{error: "conflict", message: "Código duplicado en este proyecto"}`
- `POST /api/casos` invalid script → `400` `{error: "validation", message: "Script no accesible: ..."}`
- `GET /api/casos?proyectoId=X` → `200` `CasoPrueba[]`

**Status Computation Rule**
```
if caso.ejecuciones.length === 0 → "sin ejecuciones"
else → latestEjecucion.estado (ordered by finAt desc, fallback inicioAt desc)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `validateScriptPath` integration | Mock fs.access; assert 400 on invalid path |
| Unit | P2002 to 409 translation | Mock Prisma throw; assert conflict response |
| Unit | `requireSuperadmin` in `lib/auth.ts` | Mock session + Prisma user lookup; assert 403 when non-superadmin |
| Integration | `POST /api/casos` full flow | Seed proyecto + user; hit endpoint; assert DB state |
| Integration | Dual-context list filters | Seed casos in 2 proyectos; assert filtered counts per query param |
| E2E | Superadmin creates caso | Playwright: login → navigate → fill form → assert table row |

## Migration / Rollout

No data migration required. The `CasoPrueba` table and `@@unique([proyectoId, codigo])` constraint already exist in Prisma schema. Rollback is code-only: revert the feature branch commit.

## Open Questions

- [ ] `Usuario` schema lacks an `activo` flag; the responsable selector currently lists all users. Should `activo` be added to `Usuario` in a future schema migration?
- [ ] Should `/api/usuarios` be restricted to superadmin, or available to any authenticated user for the responsable selector?
- [ ] The mockup uses `REQ-####` as the visible identifier, but the spec uses `CP-XXXX-YY` (`codigo`). Confirm display format for the table (`codigo` vs `nombre`).
