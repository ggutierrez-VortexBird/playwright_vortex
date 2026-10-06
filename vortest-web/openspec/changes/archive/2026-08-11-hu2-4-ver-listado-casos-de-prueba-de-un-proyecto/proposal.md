# Proposal: HU-2.4 — Ver listado de casos con pasos y hover-to-reveal

## Intent

Enhance the existing caso list view with two UI improvements: a "Pasos" column showing the step count from the latest execution, and hover-to-reveal action buttons for better mobile accessibility.

## Scope

### In Scope
- Add `pasosCount` field to `CasoPruebaListItem` and `listCasos()` — count of `PasoEjecucion` from the latest `Ejecucion`
- Add "Pasos" column to `CasoTable` displaying the step count
- Implement hover-to-reveal CSS for Edit/Eliminar buttons (show on row hover, hidden by default)
- Mobile fallback: buttons remain visible on touch devices via `@media (hover: none)`

### Out of Scope
- Changes to column ordering (current order preserved)
- Any changes to create/edit forms
- Changes to `getCasoById()` (single-case view)

## Capabilities

### Modified Capabilities
- `gestion-casos-prueba`: Requirement "Listado dual-contexto" is unchanged — this proposal adds a display enhancement only (new column + hover behavior)

## Approach

**Minimal Enhancement** — modify 3 files.

1. **`types/caso.ts`**: Add `pasosCount: number | null` to `CasoPruebaListItem`
2. **`lib/casos/actions.ts`**: Include `pasos: { select: { id: true } }` in the `ejecuciones` include, then compute `pasosCount = latestEjecucion?.pasos.length ?? null`
3. **`components/casos/caso-table.tsx`**: Add "Pasos" `<th>`/`<td>`, and apply `group-hover` Tailwind pattern for action buttons

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `types/caso.ts` | Modified | Add `pasosCount` field |
| `lib/casos/actions.ts` | Modified | Include pasos in ejecucion query, compute count |
| `components/casos/caso-table.tsx` | Modified | New column + hover CSS |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `pasos` query performance on large datasets | Low | Use `{ select: { id: true } }` to avoid fetching all paso fields |
| Hover-to-reveal breaks mobile UX if CSS is wrong | Low | Use `@media (hover: none)` to keep buttons visible on touch devices |

## Rollback Plan

Revert the 3 modified files to their prior state. No schema migration needed — `pasosCount` is a computed field, not stored.

## Dependencies

- Prisma `PasoEjecucion` relation already exists on `Ejecucion` (HU-0.1 schema)

## Success Criteria

- [ ] "Pasos" column shows integer count from latest execution's pasos
- [ ] "Pasos" shows `—` when no executions exist
- [ ] Edit/Eliminar buttons hidden by default, visible on row hover
- [ ] Edit/Eliminar always visible on touch devices (`@media (hover: none)`)
- [ ] `GET /api/casos` returns `pasosCount` in each item
