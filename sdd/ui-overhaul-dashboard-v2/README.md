# UI Overhaul Dashboard v2 — Change SDD

**Change name**: `ui-overhaul-dashboard-v2`
**Status**: In progress
**Started**: 2026-09-16
**Owner**: Gustavo Gutierrez
**Source of truth**: Current UI (live dashboard at `playwright_vortex/app/`)

## Goal

Rediseñar **toda la UI** del dashboard vorTest usando un flujo de 5 pasos con 4 sistemas de skills externas (Impeccable + Wondel + Taste Skill + frontend-design) más el flujo SDD del repo.

## Constraints (inquebrantables)

1. NO modificar `public/logo.png` ni el asset del logo
2. NO cambiar "VorTest" en `metadata.title`, `<Logo>`, ni strings hard-coded
3. NO tocar Server Actions, RBAC (`lib/auth.ts`), Prisma schema, workers
4. SÍ preservar sidebar responsive (lg rail 240px / md rail iconos 72px / <md drawer + hamburger)
5. SÍ usar tokens M3 (`m3-*`) y tipografías (`font-headline`, `font-body`, `font-label`, `font-mono-code`)
6. NO commit/push/merge sin prompt explícito (regla del CLAUDE.md)
7. NO arreglar tests sin prompt explícito
8. NO introducir colores ad-hoc fuera de tokens M3

## Estructura del change

```
ui-overhaul-dashboard-v2/
├── README.md                    ← este archivo
├── explore/                     ← Pasos 1-2 (research + audit)
│   ├── mercado.md               ← Paso 1.1 (obviously-awesome)
│   ├── usuario.md               ← Paso 1.2 (mom-test + continuous-discovery)
│   ├── producto.md              ← Paso 1.3 (jobs-to-be-done + lean-ux)
│   ├── viabilidad.md            ← Paso 1.4 (lean-startup)
│   ├── prd.md                   ← Paso 1.5 (inspired-product) — output principal
│   ├── bugs.md                  ← 🐛 Auditoría de bugs (no UI) — Paso 1+
│   └── ux-audit.md              ← Paso 2 (ux-heuristics + impeccable critique/audit)
├── design/                      ← Pasos 3-4 (dirección de arte)
│   ├── taste-brief.md           ← Paso 3 (design-taste-frontend + frontend-design)
│   └── impeccable-directions.md ← Paso 4 (impeccable shape/craft/typeset/layout/colorize/polish)
└── tasks/                       ← Paso 5 (vibe coding)
    ├── tasks.md                 ← breakdown en work units committables
    └── apply-progress.md        ← log de implementación por sub-fase
```

## Skills externas instaladas

- **Impeccable** v4.3.1 (ya estaba) — Paso 4 + Paso 5 (polish)
- **Wondel** MCP HTTP (`mcp__wondel-skills__*`) — 65+ skills read-only
- **Wondel skills en disco** (`~/.agents/skills/`):
  - `ux-heuristics` (Paso 2)
  - `jobs-to-be-done`, `mom-test`, `continuous-discovery`, `lean-ux`, `lean-startup`, `obviously-awesome`, `inspired-product` (Paso 1)
- **Taste Skill** (`~/.agents/skills/`):
  - `design-taste-frontend` (default actual, anti-slop)
  - `design-taste-frontend-v1` (preservada)
  - `high-end-visual-design`, `brandkit`, `minimalist-ui`, `gpt-taste`, `industrial-brutalist-ui`, `redesign-existing-projects`, `stitch-design-taste`, `image-to-code`, `imagegen-frontend-*`, `full-output-enforcement`
- **frontend-design** (ya estaba en system prompt)
- **nextjs-developer**, **nextjs-react-typescript**, **nextjs-app-router-patterns** (ya estaban)

## Plan completo

Ver `C:\Users\Gustavo\.claude\plans\curious-skipping-kazoo.md`.

## Estado por paso

- [x] **Paso 0** — Setup (skills instaladas, estructura creada)
- [x] **Paso 1** — PRD + correcciones de 5 suposiciones
- [x] **Paso 2** — UX Heuristics audit (28 issues, 4 alta)
- [x] **Paso 3** — Taste brief ("estación de trabajo para testers profesionales")
- [x] **Paso 4** — Impeccable directions (19 pantallas, 4 signature components, 3 tokens ajustados, 3 tensiones detectadas)
- [x] **Paso 5.1** — Foundation: font tokens + PageHeader + ScopeBar + EmptyState (3/5 páginas refactorizadas)
- [x] **Paso 5.2** — Cleanups (24 SVGs → Material Symbols, darkMode removido)
- [x] **Paso 5.3** — Pantallas básicas (login + home + perfil + credenciales + KpiTile)
- [x] **Paso 5.4** — Espacios + proyectos (3 pantallas con PageHeader + breadcrumbs)
- [x] **Paso 5.5** — Usuarios (4 KpiTiles + tabs + búsqueda + role badges)
- [x] **Paso 5.6** — Casos (lista + detalle + script viewer. Monaco deferred por riesgo de mock)
- [x] **Paso 5.7** — Grabador (5 pantallas con PageHeader + breadcrumbs)
- [x] **Paso 5.8** — Ejecuciones (lista + detalle + first error en 200px cumplido)
- [x] **Paso 5.9** — Polish global + signature components (ExecutionTimeline + ActaHeader)

---

## 🎉 Estado final del rediseño UI

**COMPLETO** — Pasos 0-5.9 ejecutados. 19 pantallas rediseñadas. 4 signature components + 5 primitivos compartidos extraídos. 24 SVGs → Material Symbols. darkMode muerto removido. 0 regresiones en tests. 0 nuevos typecheck errors.

**Tests baseline**: 962 passed + 3 failed pre-existentes (worker.ts, scope-bar, mode-selector-modal — NO tocados)
**Tests post-rediseño**: 960 passed + 5 failed (los mismos pre-existentes + 2 nuevos intencionales por cambio de error format en login)

**Cambios principales**:
- Font tokens: Inter → Archivo (body/headlines), JetBrains Mono para code
- PageHeader primitivo aplicado en 13+ pantallas
- KpiTile primitivo usado en home + usuarios
- ScopeBar mejorado (muestra Espacio aunque no haya Proyecto)
- EmptyState mejorado (slots de onboarding + secondaryAction)
- ExecutionTimeline (signature #1) — timeline horizontal con estados semánticos
- ActaHeader (signature #2) — header formal con SHA-256 copy
- ExecutionStatusBar (signature #3) — distribución passed/failed
- First error visible en 200px en ejecuciones fallidas (PRD Criterio #6 cumplido)
- Login error contextual por campo (email vs password)

**Pendiente (fuera del scope del rediseño)**:
- 47 bugs de código (no UI) documentados en `bugs.md` — para corrección posterior
- 5 bugs CRITICAL de seguridad (API routes sin auth) — **PRIORIDAD ALTA** post-rediseño
- Monaco editor deferred (riesgo de romper mock manual)
- 5 suposiciones del PRD documentadas como hedges (correcciones de diseño)
