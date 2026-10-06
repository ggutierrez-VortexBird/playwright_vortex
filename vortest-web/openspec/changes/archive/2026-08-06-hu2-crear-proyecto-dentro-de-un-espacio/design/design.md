# Design: HU-2.2 — Crear proyecto dentro de un espacio

## Decisions

| # | Decision | Rationale | Alternatives considered |
|---|----------|-----------|------------------------|
| 1 | `rol` como string en `Usuario`, no enum | El schema ya define `rol String @default("superadmin")`. Usar enum en TypeScript perdería sync con DB. | Enum Prisma/TypeScript — complicaría migraciones |
| 2 | Verificar superadmin en actions, no middleware | Mantiene coherencia con patrón existente (`lib/espacios/actions.ts` lanza `{ status: 403 }`). Middleware solo valida auth, no roles. | Middleware — rompería encapsulamiento y testabilidad |
| 3 | Métricas CA-4 via query复合材料 (2 queries) | Prisma no soporta window functions niCTEs nativas. Hacerlo en 2 queries (casos+ejecuciones latest) evita N+1. | 1 query con raw SQL — rompe abstracción Prisma |
| 4 | Soft delete proyectos (`activo: false`) | matches existing `deleteEspacio` pattern y preserva historial de ejecuciones. | Hard delete — perdería trazabilidad |

## File Map

```
playwright_vortex/
├── types/
│   └── proyecto.ts              # NUEVO — Proyecto, CreateProyectoInput, UpdateProyectoInput, ProyectoWithMetrics
├── lib/
│   ├── espacios/
│   │   └── actions.ts           # existente
│   └── proyectos/
│       └── actions.ts           # NUEVO — create, listByEspacio, getById, update, delete, getMetrics
├── app/
│   ├── api/
│   │   ├── espacios/
│   │   │   ├── route.ts         # existente
│   │   │   └── [id]/
│   │   │       └── route.ts     # MODIFICAR — agregar 409 si proyectos activos
│   │   └── proyectos/
│   │       ├── route.ts        # NUEVO — GET (list), POST (create)
│   │       └── [id]/
│   │           └── route.ts     # NUEVO — GET, PUT, DELETE
│   └── (dashboard)/
│       └── espacios/
│           └── [id]/
│               └── proyectos/
│                   └── page.tsx # NUEVO — RSC con Suspense
└── components/
    └── proyectos/
        └── proyecto-card.tsx    # NUEVO — client component (hooks: useRouter)
```

## API Design

### POST /api/proyectos
**Request:**
```json
{ "nombre": "string", "ambiente": "string", "espacioId": "uuid" }
```
**Response:** `201` with proyecto + `403` if not superadmin + `400` on validation.

### GET /api/proyectos?espacioId=X
**Response:** `200`
```json
{ "proyectos": [{ "id", "nombre", "ambiente", "espacioId", "totalCasos", "casosConformes", "casosNoConformes", "fechaUltimaEjecucion" }] }
```

### GET /api/proyectos/[id]
**Response:** `200` — proyecto con métricas de la última ejecución de cada caso.

### PUT /api/proyectos/[id]
**Request:** `{ "nombre"?: "string", "ambiente"?: "string" }`
**Response:** `200` + `403` if not superadmin + `404` if not found.

### DELETE /api/proyectos/[id]
**Response:** `204` + `403` if not superadmin + `404` if not found.

### DELETE /api/espacios/[id] (modificado)
Agrega `409` cuando existe al menos 1 proyecto activo con ese `espacioId`.

## Query Strategy for CA-4 (Metrics)

```
Proyecto →CasoPrueba→ Ejecucion (latest per caso)
```

**Step 1:** Contar casos totales y collect `casoPruebaIds`
```ts
const casos = await prisma.casoPrueba.findMany({
  where: { proyectoId, activo: true },
  select: { id: true }
});
const totalCasos = casos.length;
const ids = casos.map(c => c.id);
```

**Step 2:** Obtener última ejecución de cada caso
```ts
const latest = await prisma.ejecucion.groupBy({
  by: ['casoPruebaId'],
  where: { casoPruebaId: { in: ids } },
  orderBy: { finAt: 'desc' }
});
```

**Step 3:** Contar por estado desde esas ejecuciones
```ts
const estados = await prisma.ejecucion.findMany({
  where: { id: { in: latest.map(l => l.id) } },
  select: { estado: true, finAt: true }
});
const casosConformes = estados.filter(e => e.estado === 'paso').length;
const casosNoConformes = estados.filter(e => e.estado === 'fallo').length;
const fechaUltimaEjecucion = estados.map(e => e.finAt).filter(Boolean).sort().pop() ?? null;
```

**Nota:** `finAt` es nullable (`DateTime?`). La última ejecución válida es la de mayor `finAt`.

## Superadmin Verification Pattern

```ts
// En actions.ts
export async function requireSuperadmin(session: SessionData) {
  const user = await prisma.usuario.findUnique({
    where: { id: session.userId },
    select: { rol: true }
  });
  if (user?.rol !== 'superadmin') {
    throw { status: 403, body: { error: "forbidden", message: "superadmin required" } };
  }
}
```

## UI Structure

```
app/(dashboard)/espacios/[id]/proyectos/page.tsx
├── RSC (async)                           ← fetch proyectos data
│   └── <Suspense fallback={<Skeleton/>}>
│       └── <ProyectoGrid>                ← client component for interactivity
│           └── <ProyectoCard />          ← client component (hover states, actions)
```

**Data fetching:** Server Component Fetch con `next.revalidate: 0` (dynamic).

**Forms:** Native `<form>` con Server Actions para crear/editar inline.

## Tests

| Layer | What | Approach |
|-------|------|----------|
| Unit | `lib/proyectos/actions.ts` | Mock Prisma, assert thrown errors |
| Integration | `app/api/proyectos/route.ts` | `supertest` con DB real o mock |
| E2E | UI grid + CRUD flow | `playwright` spec `e2e/proyectos.spec.ts` |

**TDD flow:**
1. `__tests__/lib/proyectos/actions.test.ts` — RED (test throws)
2. Implementar actions
3. GREEN — implementar route handlers
4. `__tests__/app/api/proyectos/route.test.ts` — integration tests
5. Implementar UI

## Open Questions

- [ ] ¿El campo `versionSistema` del modelo `Proyecto` se expone en API o es interno?
- [ ] ¿Se permite editar `espacioId` de un proyecto (transferir a otro espacio)?
