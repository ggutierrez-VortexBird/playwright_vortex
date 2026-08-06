# Propuesta: Inicio de sesión (HU-1.1)

## Intención

Implementar el sistema de autenticación para la plataforma ACTA, permitiendo al superadministrador iniciar sesión de forma segura con correo y contraseña, y protegiendo el acceso a rutas internas mediante redirección al login cuando no hay sesión activa.

Vinculado a: [HU-1.1 — Inicio de sesión](../../../../../documentacion/historias-usuario-playwright-vortex.md#fase-1--esqueleto-del-proyecto-y-docker-de-desarrollo).

## Alcance

### Dentro del alcance
- Bootstrap de Next.js 15 + React 19 + TypeScript (estructura base del proyecto).
- Configuración de Tailwind CSS, shadcn/ui y TypeScript estricto.
- Docker Compose de desarrollo con Postgres 16 y volumen persistente.
- Esquema Prisma completo (todas las entidades de HU-0.1) y migración inicial.
- Semilla de base de datos con usuario superadministrador inicial.
- Página de login (`/login`) con Server Action de autenticación.
- Middleware de protección de rutas: redirección a `/login` si no hay sesión.
- Cierre de sesión con invalidación de cookie.
- Tests unitarios con Vitest + Testing Library (estricto TDD).

### Fuera del alcance
- Recuperación de contraseña.
- Múltiples roles o permisos granulares (futuro HU-6.1).
- UI del panel principal (solo layout protegido vacío).

## Capacidades

### Nuevas capacidades
- `autenticacion`: gestión de sesión con iron-session, hash de contraseñas con bcryptjs, protección de rutas vía middleware.

### Capacidades modificadas
- `modelo-de-datos-prisma`: extender el esquema para incluir el modelo `Usuario` y relaciones necesarias para autenticación.

## Enfoque

Usar `iron-session` para sesiones stateless en cookies firmadas (sin Redis ni servidor de sesiones). La contraseña se hashea con `bcryptjs` en un Server Action de Next.js. El middleware de App Router verifica la cookie en cada request y redirige a `/login` cuando no existe sesión válida. Prisma se conecta a Postgres vía `DATABASE_URL` desde variables de entorno.

## Áreas afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `package.json` | Nuevo | Dependencias del proyecto |
| `prisma/schema.prisma` | Nuevo | Esquema completo de base de datos |
| `docker-compose.dev.yml` | Nuevo/Modificado | Servicio Postgres 16 con volumen |
| `app/login/page.tsx` | Nuevo | UI de login |
| `app/login/actions.ts` | Nuevo | Server Action de autenticación |
| `app/(dashboard)/layout.tsx` | Nuevo | Layout protegido post-login |
| `middleware.ts` | Nuevo | Protección de rutas |
| `lib/auth.ts` | Nuevo | Helpers de sesión (iron-session) |
| `lib/password.ts` | Nuevo | Helpers de hash (bcryptjs) |
| `lib/db.ts` | Nuevo | Cliente Prisma singleton |
| `prisma/seed.ts` | Nuevo | Semilla de superadmin |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Conflicto de puerto 5432 en Windows | Alta | Documentar `docker-compose` con mapeo a puerto alternativo si es necesario |
| Fallo en instalación inicial del stack | Media | Instalar paso a paso y verificar `next build` antes de continuar |
| Semilla con contraseña hardcodeada | Media | Usar variable de entorno `SEED_ADMIN_PASSWORD` con fallback documentado |

## Plan de rollback

1. Revertir el commit de la feature branch.
2. Si la migración de Prisma ya se aplicó: ejecutar `npx prisma migrate reset --force` en desarrollo.
3. Eliminar volúmenes de Docker con `docker compose -f docker-compose.dev.yml down -v` si es necesario.
4. Restaurar `develop` al estado anterior con `git reset --hard` o revert.

## Dependencias

- Node.js 20+ instalado en el entorno de desarrollo.
- Docker Desktop disponible para levantar Postgres.

## Criterios de éxito

- [ ] `npm run dev` levanta Next.js sin errores de TypeScript.
- [ ] `docker compose -f docker-compose.dev.yml up` levanta Postgres accesible desde la app.
- [ ] El login con credenciales correctas redirige al dashboard.
- [ ] El login con contraseña incorrecta muestra error sin redirigir.
- [ ] Acceder a `/` sin sesión redirige a `/login`.
- [ ] Cerrar sesión invalida la cookie y redirige a `/login`.
- [ ] Tests de autenticación pasan en rojo→verde (TDD).
