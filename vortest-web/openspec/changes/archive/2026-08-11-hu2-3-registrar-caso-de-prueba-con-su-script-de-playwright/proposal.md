# Proposal: Registrar caso de prueba con su script de Playwright

## Intent

Permitir a los superadmin registrar casos de prueba asociados a un proyecto, incluyendo la ruta del script de Playwright y un responsable. Esto habilita la ejecución automatizada y la trazabilidad de evidencias.

## Scope

### In Scope
- CRUD completo de `casoPrueba` (Server Actions + API routes + types + pages + components).
- Pestaña global `/casos` con grilla y filtros.
- Listado contextual de casos dentro de `/proyectos/[id]/casos`.
- Validación eager de `rutaScript` contra `lib/script-validation.ts`.
- Unicidad de `codigo` por proyecto (`CP-XXXX-YY`).
- Selector de responsable: todos los usuarios activos.
- Refactor de autenticación: extraer `requireSuperadmin` a `lib/auth.ts` y corregir chequeo de espacios.

### Out of Scope
- Ejecución de scripts (HU-3.1).
- Self-healing o reparación de pasos (HU-4.3).
- Generación de actas (HU-5.1).
- Múltiples roles granulares (HU-6.1).
- `proyecto.slug` en rutas (aceptable para MVP).

## Capabilities

### New Capabilities
- `gestion-casos-prueba`: CRUD de casos de prueba con validación de script Playwright, selector de responsable y UI dual-contexto (global y proyecto).

### Modified Capabilities
- `autenticacion`: Extraer `requireSuperadmin` a utilidad compartida (`lib/auth.ts`) y corregir validación de espacios en rutas protegidas.

## Approach

Replicar el patrón establecido en `gestion-proyectos` (HU-2.1/HU-2.2): tipos compartidos, Server Actions para mutations, API routes para queries, páginas con `loading.tsx`/`error.tsx`, y componentes reutilizables. Validar `rutaScript` al crear/editar usando `lib/script-validation.ts`. Implementar UI dual-contexto: ruta global `/casos` y ruta anidada `/proyectos/[id]/casos`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `types/caso.ts` | New | Tipos `CasoPrueba`, `CasoPruebaFormData` |
| `lib/casos/actions.ts` | New | Server Actions: crear, editar, eliminar caso |
| `lib/auth.ts` | Modified | Extraer `requireSuperadmin`; fix espacios auth |
| `app/api/casos/*` | New | API routes: GET list, GET/PUT/DELETE by id |
| `app/(dashboard)/casos/*` | New | Página global con grilla y filtros |
| `app/(dashboard)/proyectos/[id]/casos/*` | New | Listado contextual de casos del proyecto |
| `components/casos/*` | New | Formulario, tabla, selector responsable |
| `components/proyectos/proyecto-card.tsx` | Modified | Link a pestaña de casos del proyecto |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicidad de `codigo` en proyecto | Low | Unique constraint `UNIQUE(proyectoId, codigo)` + manejo P2002 |
| `rutaScript` inválido en runtime | Low | Validación eager con `lib/script-validation.ts` al crear/editar |
| Inconsistencia auth en espacios | Med | Centralizar en `lib/auth.ts` y auditar rutas protegidas |

## Rollback Plan

Revierte el commit de la rama `feature/hu2-3-registrar-caso-de-prueba-con-su-script-de-playwright`. Si ya hay datos en `casoPrueba`, dejarlos; el rollback es de código, no de datos. El constraint `UNIQUE(proyectoId, codigo)` permanece seguro.

## Dependencies

- Esquema `casoPrueba` en Prisma (ya completo).
- `lib/script-validation.ts` (ya existe).
- Patrón `gestion-proyectos` como referencia de implementación.

## Success Criteria

- [ ] Superadmin puede crear un caso con código, nombre, ruta de script y responsable.
- [ ] El sistema rechaza códigos duplicados dentro del mismo proyecto.
- [ ] El sistema valida que `rutaScript` sea accesible antes de guardar.
- [ ] Usuario sin rol superadmin recibe `403` en mutations.
- [ ] Grilla global `/casos` lista todos los casos activos.
- [ ] Grilla contextual `/proyectos/[id]/casos` lista solo casos de ese proyecto.
- [ ] `requireSuperadmin` vive en `lib/auth.ts` y es importado por todas las rutas protegidas.
