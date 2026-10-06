# Design: Inicio de sesión (HU-1.1)

## Technical Approach

Scaffold Next.js 15 + React 19 + TypeScript strict, then implement stateless auth with `iron-session` signed cookies and `bcryptjs`. Protected routes use `middleware.ts` (Edge-safe signature check) plus the dashboard layout (DB validation). UI follows `acta-mockups.html` editorial aesthetic with CSS custom properties.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Auth library | iron-session vs jose vs Clerk | iron-session simpler than jose; Clerk overkill for single superuser | **iron-session v8+** |
| Route protection | middleware only vs layout only vs both | middleware = fast redirect but no DB; layout = DB validation but later redirect | **Both**: middleware checks cookie signature; layout verifies user exists |
| Password hasher | bcryptjs (pure JS) vs bcrypt (native) | bcrypt faster but needs node-gyp; bcryptjs zero-deps, portable | **bcryptjs** (cost factor 10) |
| Session store | iron-session cookie vs DB table | Cookie = stateless, no cleanup; DB = revocation but overkill for 1 user | **Cookie** (encrypted + signed) |
| Schema scope | Full HU-0.1 schema vs `Usuario` only | Full schema = one migration; partial = clutter later | **Full schema** (HU-0.1 already approved) |

## Data Flow

```
Browser (login form)
    │
    ▼
Server Action: app/login/actions.ts
    ├── Validate HTML5 required
    ├── Query usuario by email (Prisma)
    ├── Compare hash (bcryptjs)
    ├── Create iron-session cookie
    └── redirect('/')
        │
        ▼
Middleware: middleware.ts  (Edge Runtime)
    ├── Check cookie signature
    └── Valid? proceed / Invalid? → /login
        │
        ▼
Dashboard Layout: app/(dashboard)/layout.tsx
    ├── Read cookie with cookies()
    ├── getIronSession() → userId
    ├── Verify usuario in DB (Prisma)
    └── Render sidebar + topbar + children
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Create | Next.js 15, React 19, TS, Prisma, iron-session, bcryptjs, Tailwind, shadcn/ui, Vitest |
| `prisma/schema.prisma` | Create | Full schema from HU-0.1 (11 models + 3 enums) |
| `prisma/seed.ts` | Create | Seed superadmin from `SEED_ADMIN_PASSWORD` env var |
| `lib/db.ts` | Create | PrismaClient singleton with `globalThis` dev guard |
| `lib/auth.ts` | Create | iron-session config: cookie name, 24h TTL, conditional `secure` |
| `lib/password.ts` | Create | `hash()` / `verify()` wrappers around bcryptjs |
| `app/layout.tsx` | Create | Root layout: Archivo + IBM Plex Mono fonts, metadata |
| `app/globals.css` | Create | Mockup CSS variables (--ink, --paper, --rail, etc.) |
| `app/login/page.tsx` | Create | Server Component: login form (renders Client Component for interactivity) |
| `app/login/actions.ts` | Create | `iniciarSesion(formData)`: validate, hash compare, set cookie, redirect |
| `app/(dashboard)/layout.tsx` | Create | Protected layout: sidebar rail (224px), topbar, session verification |
| `app/(dashboard)/page.tsx` | Create | Placeholder or redirect to `/proyectos` |
| `app/(dashboard)/proyectos/page.tsx` | Create | Skeleton (no data yet) |
| `app/(dashboard)/casos/page.tsx` | Create | Skeleton |
| `app/(dashboard)/ejecuciones/page.tsx` | Create | Skeleton |
| `app/(dashboard)/credenciales/page.tsx` | Create | Skeleton |
| `app/api/logout/route.ts` | Create | Route Handler: destroy session, redirect `/login` |
| `middleware.ts` | Create | Matcher on protected routes; cookie signature check |
| `docker-compose.dev.yml` | Modify | Add `postgres:16-alpine` service with healthcheck + volume |
| `.env.example` | Create | `DATABASE_URL`, `IRON_SESSION_SECRET`, `SEED_ADMIN_PASSWORD` |

## Component Hierarchy

```
app/
├── layout.tsx                 # Root: fonts, metadata, <html lang="es">
├── login/
│   └── page.tsx               # Server Component
│       └── <LoginForm />      # Client Component (useFormState for errors)
│           └── Server Action: actions.ts
└── (dashboard)/
    ├── layout.tsx             # Server Component: auth check + shell
    │   ├── <Sidebar />        # Server Component: 224px rail
    │   │   ├── <Brand />      # "Acta" logo + subtitle
    │   │   ├── <Nav />        # Proyectos, Casos, Ejecuciones, Credenciales
    │   │   └── <RailFoot />   # Env info + logout link
    │   ├── <Topbar />         # Server Component: page title + scope placeholder
    │   └── children
    ├── page.tsx               # placeholder / redirect
    ├── proyectos/
    ├── casos/
    ├── ejecuciones/
    └── credenciales/
```

## Database Schema

`Usuario` model (from HU-0.1):

```prisma
model Usuario {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  rol          String   @default("superadmin")
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)

  espacios       UsuarioEspacio[]
  casosAsignados CasoPrueba[] @relation("CasoPruebaResponsable")

  @@index([email])
}
```

Full schema includes 10 additional models — see archived HU-0.1 design. All created in the initial migration.

## Security Considerations

- **Cookie**: `HttpOnly`, `Secure` when `NODE_ENV=production`, `SameSite=strict`, maxAge 24h.
- **Password**: bcryptjs cost factor 10. Never plaintext.
- **Enumeration prevention**: Same generic error for bad email vs bad password.
- **CSRF**: iron-session signed cookies + `SameSite=strict` mitigate CSRF. No state-changing GET endpoints.
- **Secrets**: `IRON_SESSION_SECRET` ≥ 32 chars. `SEED_ADMIN_PASSWORD` required for seed.
- **Prisma**: Parameterized queries by default; no SQL injection risk.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `lib/password.ts` hash/verify | Vitest, in-memory |
| Unit | `lib/auth.ts` session create/destroy | Vitest, mock iron-session |
| Unit | `app/login/actions.ts` validation logic | Vitest, mock Prisma + bcrypt |
| Integration | Login form → Server Action → cookie set | Vitest + @testing-library/react + jsdom |
| Integration | Middleware redirect logic | Vitest, mock Request/Response |
| E2E (future) | Full login → dashboard → logout | Playwright (product) |

Strict TDD: tests before implementation (RED→GREEN→REFACTOR).

## UI Direction

Reference: `acta-mockups.html` (editorial/documental aesthetic).

- **Fonts**: Archivo (sans) + IBM Plex Mono (mono) via `next/font/google`.
- **Variables**: `--ink` #131E2B, `--paper` #EEF2F5, `--surface` #FFFFFF, `--rule` #D7E0E7, `--stamp` #A8322A, `--rail` 224px.
- **Sidebar**: sticky, 224px, dark ink background, white text, dot indicators for nav.
- **Login**: centered card on paper background, minimal, focus-visible outline in stamp red.

## Migration / Rollout

1. Scaffold Next.js with `create-next-app`.
2. Install deps: Prisma, iron-session, bcryptjs, Vitest.
3. Add `postgres:16-alpine` to `docker-compose.dev.yml`.
4. Create `prisma/schema.prisma` (full HU-0.1 schema).
5. Run `npx prisma migrate dev --name init`.
6. Run `npx prisma db seed` to create superadmin.
7. Verify `npm run dev` + `docker compose up` + login flow.

Rollback: revert commit, `docker compose down -v`, `npx prisma migrate reset --force`.

## Open Questions

- [ ] Confirm test runner: Vitest (recommended) or Jest?
- [ ] Confirm superadmin default email (`admin@acta.local`?)
- [ ] Confirm Postgres port (5432 or fallback to 5433 if occupied?)
