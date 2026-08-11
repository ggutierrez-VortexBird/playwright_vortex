# Tasks: HU-2.5 — Identidad visual del espacio en toda la UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All visual identity changes | PR 1 | Single PR, all phases |

## Phase 1: Foundation — New Components and Types

- [x] 1.1 Create `components/ui/client-band.tsx` — Client Component, 3px vertical band on sidebar right edge, uses `useSelectedLayoutSegments` to detect espacio in URL
- [x] 1.2 Create `components/ui/espacio-switcher.tsx` — Client Component (`'use client'`), dropdown switcher with `sw-mark` color dot per espacio, accepts `espacios: Espacio[]`
- [x] 1.3 Create `components/ui/scope-bar.tsx` — Client Component, 8×8px color icon + espacio name, props: `espacioNombre`, `espacioColor?: string`, renders icon only if color defined

## Phase 2: Core Implementation — Integration

- [x] 2.1 Modify `components/proyectos/proyecto-card.tsx` — Add `espacioColor?: string` prop, apply `style={{ borderTopColor: espacioColor }}` on `.proj-card` div when color exists, add CSS `border-top: 3px solid transparent` default
- [x] 2.2 Modify `app/(dashboard)/layout.tsx` — Import `ClientBand` and `EspacioSwitcher`, add `ClientBand` as absolute span in `<aside>`, add `EspacioSwitcher` in `<header>`, fetch `espacio.color` via `getEspacioById` when URL segment matches `espacio/[id]`
- [x] 2.3 Modify `app/(dashboard)/espacios/[id]/proyectos/page.tsx` — Pass `espacioColor={espacio.color}` to `ScopeBar` (new component) and to `ProyectoGrid`
- [x] 2.4 Modify `app/(dashboard)/proyectos/proyectos-client.tsx` — Pass `espacioColor={espacio.color}` to each `ProyectoCard` inside the `.map()` loop
- [x] 2.5 Modify `app/(dashboard)/casos/page.tsx` — Add `ScopeBar` in page header area (no espacio context, ScopeBar renders without color icon)
- [x] 2.6 Modify `app/(dashboard)/espacios/espacios-client.tsx` — Replace `window.location.reload()` on line 111 with `router.refresh()` from `next/navigation`

## Phase 3: Testing — Component Verification

- [x] 3.1 Verify `ClientBand` renders nothing when no espacio is active in URL
- [x] 3.2 Verify `EspacioSwitcher` dropdown opens/closes and shows all espacios with color dots
- [x] 3.3 Verify `ScopeBar` renders color icon when `espacioColor` is passed, hides icon when null/undefined
- [x] 3.4 Verify `ProyectoCard` shows 3px colored top border when `espacioColor` is set, transparent border when unset

## Phase 4: Cleanup (if needed)

- [ ] 4.1 No cleanup expected — UI-only change, no dead code or temp files

## Implementation Order

1. Phase 1 first (new components are independent)
2. Phase 2 follows — layout.tsx and proyecto-card.tsx modifications are parallel, then espacios pages, then casos
3. Phase 3 can run in parallel with Phase 2 or after
4. Phase 4 skipped

## Key Files

| File | Action |
|------|--------|
| `components/ui/client-band.tsx` | Create |
| `components/ui/espacio-switcher.tsx` | Create |
| `components/ui/scope-bar.tsx` | Create |
| `components/proyectos/proyecto-card.tsx` | Modify |
| `app/(dashboard)/layout.tsx` | Modify |
| `app/(dashboard)/espacios/[id]/proyectos/page.tsx` | Modify |
| `app/(dashboard)/proyectos/proyectos-client.tsx` | Modify |
| `app/(dashboard)/casos/page.tsx` | Modify |
| `app/(dashboard)/espacios/espacios-client.tsx` | Modify |
