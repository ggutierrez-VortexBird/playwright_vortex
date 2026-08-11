# Design: HU-2.4 — Ver listado de casos con pasos y hover-to-reveal

## Technical Approach

Minimal Enhancement — modify 3 files to add pasosCount column and hover-to-reveal action buttons.

## Architecture Decisions

### Decision: Use Prisma `_count` for pasosCount

**Choice**: Use `include: { pasos: { select: { id: true } } }` with `take: 1` for latest execution
**Alternatives considered**: Full paso data fetch, separate count query
**Rationale**: Efficient single query, only fetches IDs not full objects

### Decision: CSS-only hover-to-reveal

**Choice**: Tailwind `group-hover:visible` + `@media (hover: none)`
**Alternatives considered**: JavaScript mouseover/mouseout handlers
**Rationale**: Pure CSS, no JS, better performance

## Data Flow

```
listCasos() → Prisma query with pasos include
           → mapper computes pasosCount from latest ejecucion.pasos.length
           → CasoPruebaListItem with pasosCount
           → CasoTable renders "Pasos" column
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `types/caso.ts` | Modified | Add `pasosCount: number \| null` to `CasoPruebaListItem` |
| `lib/casos/actions.ts` | Modified | Include `pasos: { select: { id: true } }` in latest Ejecucion query, compute `pasosCount` in mapper |
| `components/casos/caso-table.tsx` | Modified | Add "Pasos" column, hover-to-reveal buttons, mobile fallback |

## Interfaces / Contracts

```typescript
interface CasoPruebaListItem {
  // ...existing fields
  pasosCount: number | null; // NEW: count from latest ejecucion's pasos
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | listCasos() returns pasosCount | Mock Prisma with/without pasos |
| Component | CasoTable renders pasosCount, hover works | Jest + RTL |
| E2E | Full list with pasos | Playwright |

## Migration / Rollout

No migration needed — `pasosCount` is a computed field, not stored.

## Open Questions

None.
