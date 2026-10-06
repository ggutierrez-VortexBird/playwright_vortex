# Exploración — HU-1.1 Inicio de sesión

> **Cambio**: `hu1-1-inicio-de-sesion`
> **Fase**: 1 — EXPLORER (Vorkan v2.1.0)
> **Fecha**: 2026-08-05
> **Modo de persistencia**: `hybrid` (filesystem + Engram)
> **Estado del repo**: stack planeado pero NO instalado. No existe `package.json`, ni `next.config.*`, ni `prisma/schema.prisma`. Esta fase es **análisis + preparación del scaffold**: no se instala el stack, no se escribe código de producto.
> **HU anterior archivada**: HU-0.1 (modelo de datos) y HU-0.2 (convención de scripts) en `openspec/changes/archive/`.
> **Rama activa**: `feature/hu1-inicio-de-sesion` (a crear).

---

## Current State

Hoy el repositorio es un **bootstrap documental de Fase 0** que acaba de cerrar sus dos primeras HUs:

- **`openspec/config.yaml`** — creado en `sdd-init`, fija `project: acta`, `stack: nextjs-prisma-postgres`, `mode: hybrid`, `strict_tdd: true`, `status: stack-planned-not-installed`.
- **`docker-compose.dev.yml`** — existe pero **solo tiene el servicio `app`** (sin Postgres). El plan de implementación (sección 4) dice que en dev solo debe levantar Postgres; la app corre con `npm run dev` local.
- **`documentacion/`** — contiene el plan, las HUs, los mockups (`acta-mockups.html`) y la idea de negocio.
- **`playwright_vortex/`** — subcarpeta git con solo `README.md`, `docker-compose.dev.yml`, `lib/script-validation.ts` (de HU-0.2) y los artefactos openspec.
- **No hay código de producto**: ni `package.json`, ni `node_modules/`, ni `next.config.*`, ni `tsconfig.json`, ni `prisma/`, ni `app/`.
- **HU-0.1 definió el modelo de datos** (10 tablas + enums, ver archivo archivado), incluyendo la tabla `usuario` que esta HU-1.1 necesita.

**Implicación para Fase 1**: HU-1.1 es la **primera HU de implementación real**. Debe:
1. Scaffoldear el proyecto Next.js + TypeScript + Prisma + Postgres.
2. Implementar autenticación para un único superusuario.
3. Crear el esqueleto de navegación (sidebar) que las HUs 2.x usarán.
4. Actualizar `docker-compose.dev.yml` para incluir Postgres.

---

## Affected Areas

### Archivos a crear (scaffold inicial — Fase 7 IMPLEMENTER)
- `package.json` — dependencias: Next.js 15, React 19, TypeScript, Prisma, Postgres driver, `bcrypt`/`bcryptjs`, `iron-session` o `jose`, Tailwind, shadcn/ui init.
- `tsconfig.json` — strict, Next.js defaults.
- `next.config.ts` — modo `standalone` para producción (preparación Fase 8), configuración básica.
- `tailwind.config.ts` + `postcss.config.mjs` + `app/globals.css` — estilos base con las variables CSS del mockup.
- `prisma/schema.prisma` — **primera versión real** del schema, incluyendo modelo `Usuario` (de HU-0.1) + los modelos mínimos para que Prisma funcione (aunque el resto de tablas se agreguen en HU-2.x).
- `prisma/migrations/<timestamp>_init/migration.sql` — migración inicial que crea al menos `usuario`.
- `.env` / `.env.example` — `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`.
- `lib/db.ts` — singleton `PrismaClient` (patrón documentado en `nextjs-developer/references/data-fetching.md`).
- `lib/auth.ts` — lógica de sesión (crear/verificar cookie firmada).
- `lib/password.ts` — hash/verify de contraseñas con bcrypt.

### Archivos de aplicación (App Router)
- `app/layout.tsx` — layout raíz, fuentes (Archivo + IBM Plex Mono del mockup), providers mínimos.
- `app/login/page.tsx` — página de login (Server Component que renderiza form; la acción es Server Action en `app/login/actions.ts`).
- `app/login/actions.ts` — Server Action `iniciarSesion(formData)` que valida credenciales contra `usuario` en DB y crea cookie firmada.
- `app/(dashboard)/layout.tsx` — **layout protegido** con sidebar. Verifica sesión; si no hay, redirige a `/login`. Renderiza el shell visual del mockup.
- `app/(dashboard)/page.tsx` — dashboard principal (redirect a `/proyectos` o placeholder).
- `app/(dashboard)/proyectos/page.tsx` — grilla de proyectos (skeleton sin datos reales todavía; se llena en HU-2.x).
- `app/(dashboard)/casos/page.tsx` — listado de casos (skeleton).
- `app/(dashboard)/ejecuciones/page.tsx` — skeleton.
- `app/(dashboard)/credenciales/page.tsx` — skeleton.
- `app/api/logout/route.ts` — Route Handler para cerrar sesión (limpiar cookie + redirect).
- `middleware.ts` — **protección de rutas**: redirige a `/login` si no hay sesión válida; redirige a `/` si hay sesión y va a `/login`.

### Archivos a modificar
- `docker-compose.dev.yml` — **agregar servicio `postgres`** (versión 16, volumen persistente, variables de entorno). El servicio `app` actual se mantiene pero se documenta que en dev la app corre con `npm run dev` fuera de Docker.
- `playwright_vortex/README.md` — actualizar instrucciones de arranque (docker compose up + npm install + npx prisma migrate dev + npm run dev).

### Archivos NO afectados
- `documentacion/*` — **no se modifica** (regla dura).
- `lib/script-validation.ts` — no cambia.
- Artefactos archivados de HU-0.1 y HU-0.2 — inmutables.

---

## Approaches

### Eje 1 — Autenticación: ¿qué librería/patrón para una sola sesión de superusuario?

> El plan de implementación dice "sesión con cookie firmada; sin lógica de roles todavía, pero con la tabla `usuario` ya lista para más". Exploramos si esto sigue siendo la mejor opción.

| Enfoque | Pros | Contras | Complejidad |
|---------|------|---------|-------------|
| **A. Cookie firmada con `iron-session` + bcrypt** | Stateless en el servidor (no hay tabla de sesiones en DB); cookie encriptada + firmada; API simple (`getIronSession`, `save`); un solo usuario = no necesitamos gestión de sesiones múltiples; se alinea exactamente con el plan. | Requiere `SESSION_SECRET` en env; no tiene "logout remoto" (pero con un solo usuario no importa). | **Baja** |
| **B. Cookie firmada con `jose` (JWE) + bcrypt** | Misma idea que A pero con librería más ligera; `jose` es dependencia cero (Web Crypto API); estándar JWT/JWE. | Hay que armar manualmente el wrapper de sesión (crear JWE, verificar, rotar secret); más boilerplate que `iron-session`. | **Baja-Media** |
| **C. Clerk** | Auth completo listo (login UI, MFA, orgs, roles); hooks y Server Components bien integrados; skill `clerk-nextjs-patterns` ya existe en el repo. | **Overkill** para un solo superusuario; dependencia de servicio externo (SaaS); costo potencial; la app nunca tendrá "sign up" público; el plan explícitamente descarta auth compleja en Fase 1. | **Alta** (overhead de servicio) |
| **D. Auth.js (NextAuth v5 / Auth.js)** | Soporta credentials provider; muy usado en Next.js; maneja sesiones y JWT. | Over-engineering para un solo usuario; credentials provider requiere config adicional; la app no usará OAuth ni proveedores sociales; tabla de sesiones en DB o JWT en cookie (mismo resultado que A pero con más capas). | **Media** |
| **E. Lucia v3 (o similar)** | Diseñada para "roll your own auth"; tipado excelente. | **Lucia fue deprecada** en 2024; la comunidad migró a `oslo` + `lucia` legacy; no recomendable para proyecto nuevo. | **Alta** (riesgo de mantenimiento) |
| **F. Sesión en Postgres (tabla `sesion` + cookie opaca)** | Permite invalidación remota; estándar si se escala a múltiples usuarios. | Requiere tabla extra, cleanup de sesiones expiradas, más queries por request. Overkill para un solo usuario. | **Media** |

**Recomendación**: **A — `iron-session` + `bcryptjs`**.

Razones:
1. **Un solo superusuario** — no hay sign-up público, no hay recuperación de contraseña, no hay MFA, no hay orgs. Clerk/Auth.js aportan valor que no usaremos.
2. **Cookie firmada = stateless** — no necesitamos tabla de sesiones ni Redis. El worker (proceso de larga vida) no necesita compartir estado de sesión porque no atiende requests HTTP.
3. **Alineación con el plan** — el plan de implementación Fase 1 dice explícitamente "sesión con cookie firmada".
4. **`iron-session` es la abstracción estándar** para esto en Next.js (Vercel la usa en ejemplos oficiales); maneja encriptación + firma + maxAge + TTL automáticamente.
5. **Preparación para el futuro** — si en Fase 6 se habilitan múltiples usuarios, `iron-session` sigue funcionando (la cookie guarda `userId`, no un token opaco); solo habría que agregar tabla `sesion` si se quiere invalidación remota.

**Alternativa aceptable**: **B — `jose` + Web Crypto API** si el equipo prefiere evitar la dependencia `iron-session` y armar el wrapper a mano. Documentar en la decisión de Fase 4 (DESIGNER).

---

### Eje 2 — Protección de rutas: ¿middleware.ts, layout protegido, o ambos?

| Enfoque | Pros | Contras | Complejidad |
|---------|------|---------|-------------|
| **A. `middleware.ts` + matcher** | Protección temprana (antes de llegar al layout); redirección automática; puede aplicar headers de seguridad. | Corre en Edge Runtime (limitaciones: no puede usar `PrismaClient` directamente porque depende de Node APIs). | **Baja** |
| **B. Layout protegido (`app/(dashboard)/layout.tsx`)** | Puede usar `PrismaClient` y lógica de DB directamente; Server Component tiene acceso a cookies via `cookies()` de Next.js. | La ruta se resuelve primero, luego el layout redirige (un poco más tarde que middleware). | **Baja** |
| **C. Ambos** — middleware para redirect rápido, layout para validación de DB | Capas de defensa; redirect instantáneo si no hay cookie; re-validación en layout si la cookie existe pero el usuario fue borrado. | Más código; posible duplicación lógica. | **Media** |

**Recomendación**: **C — Ambos, con responsabilidades claras**:

- **`middleware.ts`**: verifica la **existencia y firma** de la cookie. Si no hay cookie válida → redirect a `/login`. No toca DB (para no pelearse con Edge Runtime). Usa `jose` (Web Crypto) para verificar la firma, o simplemente chequea presencia/estructura si la cookie es opaca.
- **`app/(dashboard)/layout.tsx`**: lee la cookie con `cookies()`, llama a `lib/auth.ts` para obtener el `userId`, consulta `db.usuario.findUnique()` para confirmar que el usuario aún existe. Si no → redirect a `/login`.

> **Nota sobre Edge Runtime**: `iron-session` v8+ soporta Edge Runtime. Si usamos `iron-session`, el middleware puede llamar directamente a `getIronSession`. Si usamos `jose`, también funciona en Edge. Prisma NO funciona en Edge → el middleware NO hace queries de DB.

---

### Eje 3 — ¿Dónde vive el hash de la contraseña del superusuario?

| Enfoque | Pros | Contras |
|---------|------|---------|
| **A. `password_hash` en tabla `usuario`** (plan de HU-0.1) | Unificado con el modelo; el superusuario es un registro más; prepara Fase 6 (múltiples usuarios). | Necesita seed/migración para crear el primer usuario. |
| **B. Variable de entorno `ADMIN_PASSWORD_HASH`** | No necesita DB para autenticar; arranque más rápido. | Rompe el modelo de datos; no se puede cambiar la contraseña sin redeploy; no escala a múltiples usuarios. |

**Recomendación**: **A — `password_hash` en `usuario`**. Es lo que HU-0.1 ya definió. El primer usuario se crea vía `prisma/seed.ts` o manualmente en la migración inicial.

---

### Eje 4 — Bootstrap de Next.js: ¿`create-next-app` o manual?

| Enfoque | Pros | Contras |
|---------|------|---------|
| **A. `npx create-next-app@latest` con flags** | Rápido, scaffold completo, config optimizada. | Genera archivos que tal vez no queremos (favicon, globals.css por defecto, etc.); hay que limpiar. |
| **B. Manual (`package.json` + archivos mínimos)** | Control total; solo lo que necesitamos. | Más trabajo; riesgo de olvidar configuración crítica. |

**Recomendación**: **A — `create-next-app` con flags controladas**, luego limpiar. Flags sugeridas:
- `--typescript`, `--tailwind`, `--eslint`, `--app`, `--src-dir=false`, `--turbopack`, `--import-alias="@/*"`.
- Luego instalar Prisma (`npm i prisma @prisma/client`), `bcryptjs`, `iron-session`, etc.
- Inicializar shadcn/ui (`npx shadcn@latest init`) para tener el sistema de componentes base que el mockup necesita.

---

### Eje 5 — ¿Qué modelos de Prisma incluir en la migración inicial?

HU-0.1 definió 10 tablas + enums. Esta HU-1.1 es la primera que scaffoldea Prisma. Decisión: ¿incluimos **todos** los modelos de HU-0.1 en la migración inicial, o solo `usuario` y lo mínimo?

| Enfoque | Pros | Contras |
|---------|------|---------|
| **A. Solo `Usuario` en esta HU** | Menor riesgo; migración pequeña; no anticipa decisiones de HU-2.x. | HU-2.1 tendría que agregar 9 tablas más en su migración; la primera migración sería muy grande; Prisma no permite "migración parcial" del schema bien (tendríamos que comentar modelos). |
| **B. Todos los modelos de HU-0.1 desde el día 1** | Un solo `prisma migrate dev` crea todo el schema; HU-2.x solo hace data, no estructura; el diagrama ER ya está aprobado (archivado). | Parece "big bang", pero HU-0.1 ya exploró y decidió cada campo; no hay riesgo de diseño. |

**Recomendación**: **B — Todo el schema de HU-0.1 en la migración inicial**.

Razón: HU-0.1 no fue "especulación"; fue un análisis profundo con 10 ejes de decisión ya resueltos. El schema está listo. La migración inicial de Prisma es el momento correcto para crear todas las tablas. Las HUs siguientes (2.x, 3.x) solo insertan datos y ajustan funcionalidad, no estructura.

---

## Recommendation

**Sí, estamos listos para Fase 2 (PROPOSER).**

La decisión de fondo es: **HU-1.1 es el punto cero del código**. Todo lo anterior fue diseño y convenciones. Aquí se decide:

1. **Auth**: `iron-session` + `bcryptjs` + cookie firmada. Un solo superusuario en tabla `usuario`.
2. **Protección de rutas**: `middleware.ts` (firma de cookie, Edge-safe) + `app/(dashboard)/layout.tsx` (validación en DB).
3. **Scaffold**: `create-next-app` + Prisma init + migración completa (todos los modelos de HU-0.1) + shadcn/ui.
4. **Docker**: Postgres 16 en `docker-compose.dev.yml`.
5. **UI**: Shell con sidebar (224px rail) según `acta-mockups.html`, con páginas skeleton para Proyectos, Casos, Ejecuciones, Credenciales.

**Lo que Fase 2 (sdd-propose) debe entregar**:
- `proposal.md` con scope de HU-1.1, decisión de auth, plan de rollback (borrar `node_modules/` y revertir `docker-compose.dev.yml`), y vinculación a los 4 criterios de aceptación.

**Lo que Fase 3 (sdd-spec) debe entregar**:
- `specs/<domain>/spec.md` con escenarios Given/When/Then para cada criterio de aceptación.

**Lo que Fase 4 (sdd-design) debe entregar**:
- `design.md` con diagrama de flujo login → dashboard → logout.
- Decisión técnica documentada: por qué `iron-session` y no Clerk/Auth.js.
- Especificación del sidebar shell (estructura de componentes, colores del mockup).

**Lo que Fase 7 (IMPLEMENTER) debe entregar**:
- `package.json` + `tsconfig.json` + `next.config.ts`.
- `prisma/schema.prisma` completo + migración inicial.
- `docker-compose.dev.yml` con Postgres.
- Páginas: `/login`, `/` (dashboard con sidebar), skeletons de `/proyectos`, `/casos`, `/ejecuciones`, `/credenciales`.
- `middleware.ts` + `lib/auth.ts` + `lib/password.ts`.
- Seed de superusuario en `prisma/seed.ts`.

---

## Risks

1. **Stack no instalado = primera vez que tocamos código real**. Un error en `package.json` o `tsconfig.json` puede bloquear todas las HUs siguientes. Mitigación: seguir exactamente las convenciones de `nextjs-react-typescript` y `nextjs-developer`.

2. **`strict_tdd: true` sin runner instalado**. La config dice `runner_installed: false`. HU-1.1 debe instalar el test runner (Vitest o Jest) como parte del scaffold. Si no, los tests de login no se pueden escribir. Mitigación: instalar Vitest (recomendado por Next.js community) + `@testing-library/react` + `jsdom` durante el scaffold.

3. **Postgres 16 en Docker Desktop Windows**. En Windows con Docker Desktop, volumen persistente de Postgres funciona bien (WSL2 backend), pero hay que verificar que el puerto 5432 no esté ocupado por otro servicio local. Mitigación: usar puerto alterno (`5433:5432`) si es necesario, documentado en `.env.example`.

4. **Sesión en desarrollo sin HTTPS**. `iron-session` requiere `cookieOptions.secure: true` en producción, pero en dev (`localhost`) debe ser `false`. Si se olvida, la cookie no se setea en Chrome. Mitigación: leer `NODE_ENV` en `lib/auth.ts`.

5. **Seed del superusuario**. El primer usuario necesita un email y un hash de contraseña. ¿Quién genera el hash? Opciones: (a) script de seed que hashea una contraseña de env var, (b) migración SQL manual con hash pre-calculado, (c) comando CLI (`npx tsx scripts/create-superuser.ts`). Recomendación: **(a)** — `prisma/seed.ts` lee `SEED_ADMIN_PASSWORD` del entorno, hashea con bcrypt, inserta el usuario. Si la env var no existe, el seed falla con mensaje claro.

6. **Shadcn/ui + custom CSS del mockup**. El mockup usa variables CSS custom (`--ink`, `--paper`, `--rail`, etc.) y fuentes de Google (Archivo, IBM Plex Mono). Shadcn/ui por defecto usa una paleta diferente. Hay que configurar `globals.css` con las variables del mockup y sobrescribir los tokens de shadcn. Riesgo de inconsistencia visual. Mitigación: en Fase 4 (DESIGNER), documentar el mapeo de variables shadcn → variables del mockup.

7. **Middleware + Edge Runtime + `iron-session`**. `iron-session` v8+ funciona en Edge, pero hay que confirmar la versión exacta al instalar. Si usamos una versión anterior, el middleware no podrá leer la sesión. Mitigación: fijar versión `^8.0.0` o superior en `package.json`.

8. **Prisma Client en Server Components**. Next.js 15 con React 19 requiere `await` en cookies/headers. Prisma Client debe ser singleton (`globalForPrisma`). Si no se hace bien, en desarrollo (Hot Module Replacement) se crean múltiples instancias y se agotan las conexiones de Postgres. Mitigación: implementar exactamente el patrón del skill `nextjs-developer`.

9. **Sidebar como "shared layout"**. El mockup muestra un sidebar sticky de 224px. En App Router, esto es un `layout.tsx` dentro del route group `(dashboard)`. Pero el plan dice que en Fase 2 se agrega el "switcher de proyecto" y el "scope-bar". El layout de HU-1.1 debe ser **extensible** para no rehacerlo en HU-2.x. Mitigación: diseñar el layout con slots o props que permitan inyectar el `scope-bar` y el `switcher` más adelante.

10. **No hay `logout` en el mockup visual**. El mockup no muestra un botón de "Cerrar sesión". Hay que decidir dónde va (¿footer del sidebar? ¿topbar?). Recomendación: footer del sidebar, debajo de "Ambiente QA / Playwright X.X.X", como un link discreto.

---

## Ready for Proposal

**Yes — listo para Fase 2 (PROPOSER).**

### Lo que Fase 2 debe resolver
- Confirmar la decisión de `iron-session` vs `jose` (técnico, no bloqueante).
- Definir el email del superusuario por defecto (¿`admin@acta.local`?).
- Confirmar si el sidebar skeleton de HU-1.1 incluye ya las 4 rutas de navegación (Proyectos, Casos, Ejecuciones, Credenciales) o solo un placeholder.

### Bloqueos para la próxima fase
1. **¿Postgres 16 o 15?** — HU-0.1 recomendó 16 para `uuid(7)`. Confirmar si el entorno de desarrollo del usuario lo soporta.
2. **¿Puerto de Postgres en dev?** — 5432 por defecto, pero si está ocupado necesitamos alternativa.
3. **¿Contraseña del superusuario en seed?** — ¿el usuario la provee como env var, o usamos un default inseguro para dev?
4. **¿Test runner: Vitest o Jest?** — La config dice "Vitest o Jest — a decidir en Fase 4 DESIGNER". Pero HU-1.1 necesita instalar uno para poder escribir tests. Recomendación: Vitest (más rápido, nativo ESM, mejor integración con Vite/Turbopack).

---

## Apéndice — Mapa de rutas y componentes (propuesta)

```
app/
├── layout.tsx                 # Root layout: fuentes, metadata, <html>
├── globals.css                # Variables CSS del mockup + Tailwind
├── login/
│   ├── page.tsx               # Server Component: formulario de login
│   └── actions.ts             # Server Action: validar credenciales, crear sesión
├── (dashboard)/               # Route group (sin segmento URL)
│   ├── layout.tsx             # Layout protegido: sidebar + topbar + verifica sesión
│   ├── page.tsx               # Redirect a /proyectos o placeholder
│   ├── proyectos/
│   │   └── page.tsx           # Skeleton: grilla de proyectos (HU-2.x llena datos)
│   ├── casos/
│   │   └── page.tsx           # Skeleton: listado de casos
│   ├── ejecuciones/
│   │   └── page.tsx           # Skeleton: listado de ejecuciones
│   └── credenciales/
│       └── page.tsx           # Skeleton: listado de credenciales
├── api/
│   └── logout/
│       └── route.ts           # Route Handler: limpiar cookie, redirect a /login
└── error.tsx                  # Error boundary global
lib/
├── db.ts                      # PrismaClient singleton
├── auth.ts                    # iron-session wrapper: getSession, createSession, destroySession
├── password.ts                # bcrypt hash/verify
└── utils.ts                   # cn() helper (shadcn) + utilidades
components/
├── ui/                        # shadcn/ui components (Button, Input, Card, etc.)
├── sidebar.tsx                # Rail de navegación (224px, del mockup)
├── topbar.tsx                 # Barra superior con título y scope-bar (placeholder)
└── logout-button.tsx          # Client Component: botón de cerrar sesión
prisma/
├── schema.prisma              # Todos los modelos de HU-0.1 + ajustes menores
├── migrations/
│   └── <timestamp>_init/
│       └── migration.sql      # Creación de todas las tablas y enums
└── seed.ts                    # Crea superusuario con contraseña hasheada
```

---

## Apéndice — Sidebar skeleton según mockup

Del archivo `acta-mockups.html`, el sidebar (`<aside class="rail">`) tiene esta estructura:

1. **Brand** (`div.brand`):
   - Título: "Acta" (h1, 22px, bold, uppercase, tracking wide).
   - Subtítulo: "Automatización de pruebas" (11px, muted).

2. **Project Switcher** (`div.switcher` — aspiracional para HU-2.x):
   - En HU-1.1 puede ser un placeholder o omitirse.
   - Muestra cliente + proyecto activo.
   - Dropdown con lista de proyectos recientes.

3. **Navigation** (`nav.nav`):
   - Botones verticales con dot indicator:
     - Proyectos
     - Casos de prueba
     - Ejecuciones
     - Credenciales
   - Estado activo: `aria-current="true"`.

4. **Footer** (`div.rail-foot`):
   - "Ambiente QA"
   - "Playwright X.X.X"
   - **HU-1.1 añade**: link de "Cerrar sesión".

5. **Client Band** (`span.client-band`):
   - Franja vertical derecha de 3px con color del cliente.
   - En HU-1.1: color por defecto o sin color (gris).

**Variables CSS del mockup** (a copiar en `globals.css`):
```css
:root {
  --ink: #131E2B;
  --ink-2: #3A4B5C;
  --ink-3: #6B7C8D;
  --paper: #EEF2F5;
  --surface: #FFFFFF;
  --rule: #D7E0E7;
  --rule-soft: #E7EDF1;
  --stamp: #A8322A;
  --seal: #0E6B4F;
  --amber: #A9741A;
  --rail: 224px;
  --sans: 'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --mono: 'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
}
```

---

## Apéndice — docker-compose.dev.yml propuesto (solo servicio postgres)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: acta-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: acta
      POSTGRES_PASSWORD: acta_dev
      POSTGRES_DB: acta_dev
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U acta -d acta_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
    driver: local
```

> Nota: el servicio `app` actual se mantiene para referencia, pero en desarrollo la app Next.js corre con `npm run dev` directamente en el host, apuntando a `DATABASE_URL=postgresql://acta:acta_dev@localhost:5432/acta_dev`.

---

## skill_resolution

- `sdd-explore` — propia skill de la fase, leída y cumplida.
- `sdd-phase-common` (shared) — leída para convención de persistencia hybrid y return envelope.
- `openspec-convention` (shared) — leída para path `openspec/changes/<change>/explore/exploration.md`.
- `nextjs-developer` — cargado. Define App Router, Server Components, Server Actions, `loading.tsx`/`error.tsx`, `generateMetadata`.
- `nextjs-app-router-patterns` — cargado. Define estructura de `app/`, route groups, layouts, streaming.
- `nextjs-react-typescript` — cargado. Define kebab-case, named exports, TS estricto, shadcn/ui, minimizar `'use client'`.
- `clerk-nextjs-patterns` — cargado para comparar. Confirmado: overkill para un solo superusuario; el plan ya descartaba auth compleja en Fase 1.

---

## artifacts_written

- Este archivo: `openspec/changes/hu1-1-inicio-de-sesion/explore/exploration.md`
- Engram: observación `sdd/hu1-1-inicio-de-sesion/explore` (topic_key reutilizable).
