# Tasks: HU-1.1 — Inicio de sesión

## Phase A: Bootstrap (Next.js + Tooling)

- [x] A.1 Create `package.json` with Next.js 15, React 19, TypeScript, Prisma, iron-session, bcryptjs, Jest, Testing Library, Tailwind, shadcn dependencies
- [x] A.2 Create `tsconfig.json` with strict TypeScript config
- [x] A.3 Create `next.config.ts` with standalone output mode
- [x] A.4 Create `tailwind.config.ts` with ACTA design system variables
- [x] A.5 Create `postcss.config.mjs`
- [x] A.6 Create `app/globals.css` with Tailwind directives + CSS variables from mockup
- [x] A.7 Create `components.json` for shadcn/ui config
- [x] A.8 Create `app/layout.tsx` with root layout, Archivo + IBM Plex Mono fonts, metadata
- [x] A.9 Run `npm install` to verify dependency resolution

## Phase B: Infrastructure (Docker + Prisma + Seed)

- [x] B.1 Update `docker-compose.dev.yml` with `postgres:16-alpine` service and persistent volume
- [x] B.2 Create `.env.example` with `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_PASSWORD`, etc.
- [x] B.3 Create `prisma/schema.prisma` with ALL models from HU-0.1
- [x] B.4 Create `lib/db.ts` with Prisma singleton (`globalForPrisma` pattern)
- [x] B.5 Create `prisma/seed.ts` to create superuser `admin@admin.com` with hashed password from env
- [x] B.6 Add Prisma scripts and seed configuration to `package.json`

## Phase C: Auth UI & Logic (Future batch)

- [x] C.1 Create `lib/auth.ts` with iron-session config
- [x] C.2 Create `lib/password.ts` with bcryptjs wrappers
- [x] C.3 Create `app/login/page.tsx` and `app/login/actions.ts`
- [x] C.4 Create `middleware.ts` for route protection
- [x] C.5 Create `app/(dashboard)/layout.tsx` and skeleton pages
- [x] C.6 Create `app/api/logout/route.ts`

## Phase D: Tests & Verification (Future batch)

- [x] D.1 Install and configure Jest + Testing Library
- [x] D.2 Write auth unit tests (password, session)
- [x] D.3 Write integration tests for login flow
- [ ] D.4 Run `npx prisma migrate dev --name init` and seed
- [ ] D.5 Verify `npm run dev` + `docker compose up` + login flow
