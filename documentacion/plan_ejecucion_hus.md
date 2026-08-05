# Plan de Ejecución de HUs

> Documento vivo. Cada vez que se ajuste algo del flujo, se actualiza acá.

## Objetivo

Estandarizar cómo se ejecuta cada **Historia de Usuario (HU)** en este repo, usando el pipeline completo de **Vorkan v2.1.0** (las 9 fases), con una **compuerta manual antes del commit/merge** para que vos valides cada HU con tus propias manos antes de que quede cerrada oficialmente.

## Principios

1. **Una rama por HU**, encadenada e incremental.
2. **Todas las fases de Vorkan** para cada HU (pipeline FEATURE completo: 9 fases).
3. **Nada de commit ni merge sin tu visto bueno manual**.
4. **Verificación en cascada**: primero la IA verifica con `VERIFIER` (revisión adversarial), declara *"ya está todo listo"*; después vos validás a mano contra los escenarios de la spec; recién cuando decís *"sí"* se commitea y se mergea.
5. **Siempre usar la skill correspondiente** a cada acción (no improvisar comandos a mano).

## Naming de ramas (encadenadas e incrementales)

```
develop ────────────────────────────────────────────────►  (acá solo entran HUs validadas)
  └─ feature/hu1-<slug> ──► feature/hu2-<slug> ──► feature/hu3-<slug> ...
```

- `feature/hu1-<slug>` se corta desde `develop`.
- `feature/hu2-<slug>` se corta desde `feature/hu1-<slug>` → ya trae los cambios de la 1.
- `feature/hu3-<slug>` se corta desde `feature/hu2-<slug>` → ya trae 1 + 2.
- General: `feature/huN-<slug>` se corta desde `feature/hu(N-1)-<slug>`.
- Al validar una HU → **squash-merge a `develop`** (un commit limpio por HU, rollback trivial).

`<slug>` es la versión kebab-case del título de la HU, generada automáticamente. Ejemplos:
- `lanzar HU 3: Login con Google` → `feature/hu3-login-con-google`
- `lanzar HU 7: Endpoint GET /products con paginación` → `feature/hu7-endpoint-get-products-con-paginacion`

**Por qué encadenadas**: si algo falla en `feature/hu3-<slug>`, el estado de `feature/hu2-<slug>` queda intacto y es fácil volver y corregir sin tocar lo anterior.

**Por qué squash-merge a develop**: cada commit en `develop` representa una HU validada por vos. Diff por HU, rollback por HU.

## Flujo por HU (las 9 fases de Vorkan + compuerta manual)

```
feature/huN-<slug>  (cortada de feature/hu(N-1)-<slug>, o de develop si es la primera)
│
├── 1. EXPLORER         — análisis del problema y contexto (minimax-m2.5)
│     └── ⛔ CHECKPOINT 1 (post-exploración) — pausa para tu visto bueno
│
├── 2. PROPOSER         — propuesta de cambio (kimi-k2.5)
│
├── 3. SPEC-WRITER      — specs con escenarios (kimi-k2.6)
│
├── 4. DESIGNER         — diseño técnico (kimi-k2.6)
│     └── ⛔ CHECKPOINT 2 (post-diseño) — pausa para tu visto bueno
│
├── 5. TASK-PLANNER     — tareas de implementación (minimax-m2.5)
│     └── ⛔ CHECKPOINT 3 (post-plan) — pausa para tu visto bueno
│
├── 6. TDD-GUARDIAN     — tests primero (kimi-k2.6)
│
├── 7. IMPLEMENTER      — implementación (kimi-k2.7)
│
├── 8. VERIFIER         — verificación adversarial con otro proveedor (minimax-m2.7)
│     └── (la IA itera corrigiendo hasta que VERIFIER dé limpio)
│
├── 🛑 COMPUERTA MANUAL  — tu visto bueno
│     • El orquestador dice: "ya está todo listo para probar"
│     • VOS probás a mano contra la checklist de escenarios de la spec
│     • VOS decís "sí" → recién acá pasa al cierre
│     • Si decís "no" → vuelvo a IMPLEMENTER y repito desde el paso 7
│
├── 9. ARCHIVER         — cierre y memoria (minimax-m2.5)
│     • commit final con work-unit-commits
│     • squash-merge de feature/huN-<slug> a develop
│     • (opcional) branch-pr para abrir PR si el repo lo requiere
│
└── Siguiente HU: feature/hu(N+1)-<slug> se corta desde feature/huN-<slug> ya mergeada
```

## Las 4 checkpoints

| # | Cuándo | Quién | Para qué |
|---|---|---|---|
| 1 | Post-EXPLORER | IA + vos | Confirmar entendimiento del problema y del alcance |
| 2 | Post-DESIGNER | IA + vos | Validar arquitectura, modelo de datos, integraciones |
| 3 | Post-TASK-PLANNER | IA + vos | Aprobar el plan de tareas antes de gastar esfuerzo codificando |
| 4 | Post-VERIFIER (**manual**) | **Vos** | Validación a mano contra los escenarios de la spec |

- Las **primeras 3** son obligatorias por la constitución de Vorkan v2.1.0 (modo Human-in-the-Loop corporativo).
- La **4ª** es la compuerta manual que vos pediste: es la **única** que te exige probar a mano antes del commit.

## Skills a usar por fase

| Acción | Skill |
|---|---|
| Inicializar el repo (una sola vez) | `sdd-init` |
| Explorar el problema | `sdd-explore` |
| Armar la propuesta | `sdd-propose` |
| Escribir la spec con escenarios | `sdd-spec` |
| Diseñar la arquitectura | `sdd-design` |
| Romper en tareas | `sdd-tasks` |
| Implementar | `sdd-apply` |
| Planificar commits como unidades revisables | `work-unit-commits` |
| Crear la PR | `branch-pr` |
| Si la HU es grande (>400 líneas) | `chained-pr` |
| Cerrar y archivar la HU | `sdd-archive` |
| Revisión adversarial profunda (opcional, complementaria) | `judgment-day` |
| (Si aplica) Comentarios de PR / comunicación | `comment-writer` |

> **Regla**: para cada paso del flujo se invoca la skill correspondiente. No se inventan comandos sueltos si existe una skill para eso.

## Skills de `.agents/` del proyecto (específicas de Next.js)

> ### Regla de prioridad de skills
>
> - **Tarea específica del framework** (Next.js / Clerk / React / TypeScript en este repo) → **siempre** se usan primero las skills de `./.agents/skills/`. Son la fuente de verdad para el framework.
> - **Cualquier otra tarea** (workflow SDD, commits, PRs, review adversarial, git, docs, etc.) → skills globales de `~/.config/opencode/skills/`.
> - **Si una tarea del framework no tiene skill dedicada en `./.agents/skills/`** → recién ahí se recurre a las globales o se instala/crea una skill específica para el proyecto.

Estas skills viven en la **carpeta del proyecto** `./.agents/skills/` y contienen información valiosa para la **creación y ejecución correcta de componentes en Next.js**. Se invocan **además** de las skills SDD/WM durante el flujo de cada HU:

| Skill del proyecto | Qué aporta | Cuándo usarla en el flujo de Vorkan |
|---|---|---|
| `nextjs-developer` | Senior Next.js 14+ (App Router, RSC, Server Actions, data fetching, deployment). Tiene references de app-router, server-components, server-actions, data-fetching, deployment. | **EXPLORER (1)**, **DESIGNER (4)** e **IMPLEMENTER (7)**. Skill general de Next.js — se carga siempre que la HU sea de Next.js. |
| `nextjs-app-router-patterns` | App Router: Server Components, streaming, parallel routes, data fetching, file conventions (`layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `route.ts`). | **DESIGNER (4)** para estructura de rutas e **IMPLEMENTER (7)** cuando se trabaja en `app/`. |
| `clerk-nextjs-patterns` | Auth con Clerk + Next.js: `auth()`, middleware (Next.js ≥16 `proxy.ts`, ≤15 `middleware.ts`), Server Actions protegidas, API routes (401/403), caching user-scoped, JWTs. | **DESIGNER (4)** e **IMPLEMENTER (7)** cuando la HU toca autenticación, autorización, sesión, middleware o protección de rutas. |
| `nextjs-react-typescript` | Convenciones de código: TypeScript estricto, componentes funcionales, Shadcn UI, Radix, Tailwind, naming (`components/auth-wizard`), named exports, mobile-first, Server Components por defecto. | **IMPLEMENTER (7)** como guía de estilo obligatoria en cada archivo nuevo. |

### Dónde encajan en el flujo de Vorkan

```
EXPLORER (1)        → nextjs-developer (entender el stack y la app existente)
DESIGNER (4)        → nextjs-app-router-patterns (estructura de rutas)
                     → nextjs-developer (arquitectura general)
                     → clerk-nextjs-patterns (si toca auth)
SPEC-WRITER (3)     → las convenciones de arriba quedan reflejadas en la spec
TDD-GUARDIAN (6)    → tests coherentes con las convenciones Next.js
IMPLEMENTER (7)     → nextjs-developer + nextjs-app-router-patterns
                     → nextjs-react-typescript (estilo de código obligatorio)
                     → clerk-nextjs-patterns (si toca auth)
VERIFIER (8)        → chequeos específicos de Next.js (ver lista abajo)
```

### Reglas duras para HUs de Next.js

- **Toda HU de este repo es de Next.js** → debe cargar como mínimo `nextjs-developer` + `nextjs-react-typescript` en implementación.
- Si toca **auth / login / sesión / middleware / protección de rutas** → agregar `clerk-nextjs-patterns` (obligatoria, no opcional).
- Si toca **App Router, layouts, páginas, rutas, streaming, data fetching** → agregar `nextjs-app-router-patterns`.
- El estilo de `nextjs-react-typescript` (TypeScript estricto, named exports, kebab-case en directorios, Shadcn/Radix/Tailwind, Server Components por defecto) **es ley** en todo archivo nuevo.

### Chequeos que el VERIFIER ejecuta específicamente para Next.js

- Se usa **App Router** (`app/`), nunca Pages Router.
- Componentes son **Server Components por defecto**; `'use client'` solo en hojas con justificación real.
- Cada segmento async tiene `loading.tsx` y `error.tsx`.
- Imágenes con `next/image`, nunca `<img>` plano.
- Tipografías con `next/font`.
- SEO con `generateMetadata` o `metadata` export; nunca `<title>` hardcoded en JSX.
- `fetch` con `cache` o `next.revalidate` explícito (no caching implícito).
- Si usa Clerk: `await auth()` (no `auth()` sin await), matcher correcto en `proxy.ts`/`middleware.ts`, `userId` en keys de `unstable_cache`, Server Actions protegidas, 401 vs 403 bien diferenciados.

### Estado actual de `./.agents/skills/`

- `clerk-nextjs-patterns` ✅ (v2.2.0)
- `nextjs-app-router-patterns` ✅
- `nextjs-developer` ✅ (v1.1.0)
- `nextjs-react-typescript` ✅

## Referencia visual de diseño (`acta-mockups.html`)

Para todo lo relacionado con **UI / visual** de esta app, el archivo **`./acta-mockups.html`** (en la raíz del repo) es la **fuente de verdad del diseño**. Contiene los mockups navegables de las 7 vistas de ACTA:

1. **Proyectos** — listado con color por cliente
2. **Casos de prueba** — tabla de casos por proyecto
3. **Grabador** — navegador en vivo + acta de pasos a la derecha
4. **Editor** — revisión y ajuste de pasos + parámetros
5. **Ejecución** — resultado con video, capturas y pasos fallados/reparados
6. **Acta de evidencia** — documento de auditoría con hashes de integridad
7. **Credenciales** — gestión de credenciales por proyecto

### Sistema de diseño definido en el mockup

- **Tipografía**: `Archivo` (sans, headings/body) + `IBM Plex Mono` (mono, metadatos, chips, hashes)
- **Paleta**: `--ink` (#131E2B), `--paper` (#EEF2F5), `--surface` (#FFFFFF), `--rule` (#D7E0E7), `--stamp` (rojo · no conforme), `--seal` (verde · conforme), `--amber` (reparado), `--param` (morado · variables), `--client` (naranja · acento por cliente)
- **Componentes firma**: `.stamp` (sello inclinado con pulso), `.ledger` (acta de pasos), `.step` + `.step-assert`, `.pill` (estados: pass/fail/heal/idle), `.chip-param`, `.chip-secret`, `.acta` (documento de evidencia)
- **Layout**: rail lateral oscuro sticky + topbar + body con grid de 2 columnas (vista principal + panel lateral cuando aplica)
- **Dirección estética**: editorial / documental — "acta notarial" sobria, sellos rojos inclinados como elemento de identidad, tipografía con peso, colores con propósito semántico (no decorativos)

### Cómo se usa en el flujo de Vorkan

- **SPEC-WRITER (3)**: los criterios de aceptación de UI referencian componentes del mockup. No se inventan componentes nuevos sin justificación.
- **DESIGNER (4)**: cuando la HU toca UI → abrir `acta-mockups.html` como **referencia visual obligatoria**. Decisiones de layout, color, tipografía y componentes deben ser consistentes con el sistema del mockup.
- **IMPLEMENTER (7)**: aplicar el sistema visual del mockup. Si la HU necesita un componente nuevo → primero chequear si ya existe en el mockup; si no, proponer uno dentro de la misma dirección estética (editorial/documental) y validarlo en checkpoint.
- **VERIFIER (8)**: validar que la UI implementada respete el sistema visual (colores por semántica, tipografía, uso correcto de `.stamp`, `.pill`, `.chip-param`, etc.).

### Ajustes pendientes

> El mockup **tiene cosas por ajustar** (lo confirmó el dueño del producto). Es la **referencia base**, no un contrato cerrado. Si una HU descubre una inconsistencia o propone una mejora visual, se documenta en la spec, se propone el ajuste al mockup y **recién después de tu OK** se implementa. No se implementa en contra del mockup sin acuerdo previo.

## Regla de oro

> **El orquestador no hace push, ni merge, ni commit final sin tu visto bueno.**
>
> El proceso de Vorkan termina en el paso 8 (VERIFIER limpio) más el aviso *"ya está todo listo"*. El commit/merge (paso 9) **solo se ejecuta después de tu "sí"** en la compuerta manual.

## Prompt diario

Para lanzar una nueva HU basta con decir:

```
lanzar HU N: <título corto> — <criterios de aceptación>
```

Ejemplos:

- `lanzar HU 3: Login con Google — debe redirigir a /dashboard tras OAuth exitoso y guardar el usuario en la DB.`
- `lanzar HU 7: Endpoint GET /products con paginación — query params page y pageSize, respuesta JSON con items y total.`

El orquestador carga este plan, corta la rama desde la anterior, y ejecuta las 9 fases hasta la compuerta manual.

## Cómo revertir si algo sale mal

| Escenario | Acción |
|---|---|
| Falla en validación manual (paso 🛑) | Corregir dentro de `feature/huN-<slug>` y volver a correr VERIFIER (paso 8) |
| La HU N se descarta y no va a develop | Se descarta `feature/huN-<slug>`; la siguiente HU corta desde `feature/hu(N-1)-<slug>` (la última validada) |
| `develop` quedó con una HU mala | Revertir el squash-merge; reabrir la HU en una nueva rama desde la última HU válida |
| Bug dentro de una HU ya mergeada | Abrir una nueva HU "fix" encadenada desde la rama actual |

`develop` siempre refleja **solo HUs validadas**. Las ramas `feature/huN-<slug>` son el work in progress.

## Resumen ejecutivo (TL;DR)

1. Cortás `feature/huN-<slug>` desde `feature/hu(N-1)-<slug>` (o desde `develop` si es la 1).
2. Vorkan ejecuta las 9 fases, parando en las 3 checkpoints corporativas para tu OK.
3. VERIFIER limpia todo → la IA dice *"ya está todo listo"*.
4. **Vos** probás a mano contra los escenarios de la spec.
5. **Vos** decís *"sí"* → recién ahí se commitea y se squash-mergea a `develop`.
6. La siguiente HU corta desde `feature/huN-<slug>` ya mergeada.