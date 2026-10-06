# Propuesta: HU-2.2 — Crear proyecto dentro de un espacio

## Intención

Permitir al superadministrador crear un proyecto dentro de un espacio de empresa, indicando su nombre y ambiente, para agrupar los casos de prueba correspondientes a esa iniciativa. El proyecto queda asociado únicamente al espacio seleccionado y se muestra en una grilla con métricas de la última ejecución.

## Alcance

### Dentro del alcance
- Tipos TypeScript para `Proyecto` (`types/proyecto.ts`).
- Acciones BD para CRUD de proyectos (`lib/proyectos/actions.ts`).
- Rutas API: `GET/POST /api/proyectos/` y `GET/PUT/DELETE /api/proyectos/[id]/`.
- Página de proyectos dentro de un espacio (`/espacios/[id]/proyectos/page.tsx`).
- UI de tarjeta de proyecto (`.proj-card`) con: chip de espacio, nombre, ambiente, conteo total de casos, casos conformes en última ejecución, casos no conformes en última ejecución, fecha de última ejecución.
- Verificación de rol superadmin en creación de proyectos.

### Fuera del alcance
- Creación/edición de casos de prueba (HU-2.3).
- Ejecución de casos (HU-3.x).
- Múltiples ambientes por proyecto (un proyecto = un ambiente).
-转移 de proyectos entre espacios.

## Capacidades

### Nuevas capacidades
- `gestion-proyectos`: CRUD completo de proyectos asociados a un espacio, incluyendo listado en grilla con métricas de ejeciones y verificación de rol superadmin para escritura.

### Capacidades modificadas
- `modelo-de-datos-prisma`: el modelo `Proyecto` ya existe; esta HU lo expone via API y UI.

## Enfoque

Usar Next.js App Router con Server Actions para mutaciones y React Server Components para lectura. La grilla de proyectosconsulta `Proyecto` con agregación de conteos desde `CasoPrueba` y `Ejecucion`. El rol superadmin se verifica en cada Server Action de escritura. Las tarjetas usan el mockup `.proj-card` como referencia visual.

## Áreas afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `types/proyecto.ts` | Nuevo | Tipos TypeScript para proyecto |
| `lib/proyectos/actions.ts` | Nuevo | Acciones BD (create, getByEspacio, getById, update, delete) |
| `app/api/proyectos/route.ts` | Nuevo | GET (list by espacio) + POST (create) |
| `app/api/proyectos/[id]/route.ts` | Nuevo | GET + PUT + DELETE |
| `app/espacios/[id]/proyectos/page.tsx` | Nuevo | Página de grilla de proyectos |
| `components/proyectos/proyecto-card.tsx` | Nuevo | Tarjeta `.proj-card` con métricas |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Cascada silenciosa al borrar espacio | Baja | La FK `proyecto→espacio` usa `onDelete: Restrict`; el driver de BD rechazará la operación |
| N+1 en conteos de casos por proyecto | Media | Usar `include` con agregación en Prisma para obtener todos los conteos en una query |

## Plan de rollback

1. Revertir el commit de la feature branch.
2. Si hay migración pendiente: `npx prisma migrate dev --create-only` para comparar y revertir.
3. Restaurar `develop` con `git reset --hard` o revert.
4. Nota: el modelo Prisma `Proyecto` no se elimina; solo se revierten las capas de API, types y UI.

## Dependencias

- Modelo `Proyecto` ya existe en `prisma/schema.prisma` con FK `espacioId`.
- Autenticación superadmin ya implementada (HU-1.1).

## Criterios de éxito

- [ ] POST `/api/proyectos/` con body válido crea un proyecto y devuelve 201.
- [ ] GET `/api/proyectos/?espacioId=X` devuelve solo proyectos de ese espacio.
- [ ] Crear un proyecto sin rol superadmin devuelve 403.
- [ ] La página `/espacios/[id]/proyectos` muestra tarjetas con todos los campos del mockup.
- [ ] Dado un espacio con proyectos, DELETE espacio devuelve error 409 (proyectos activos).
- [ ] Tests unitarios de acciones BD pasan en rojo→verde (TDD).
