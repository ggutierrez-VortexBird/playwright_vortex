# Proposal: HU-2.5 — Identidad visual del espacio en toda la UI

## Intent

Hacer visible y consistente el color de cada espacio en toda la UI para reducir errores de ejecutar pruebas contra el cliente/espacio equivocado. El color del espacio activo debe aparecer en 4 puntos visuales claramente distinguibles.

## Scope

### In Scope
- 4 puntos visuales del color del espacio (client-band, sw-mark, scope-bar, border-top proyecto)
- Componentes: `ClientBand`, `EspacioSwitcher`, `ScopeBar`
- Modificación de `ProyectoCard` para recibir `espacioColor` como prop
- Propagación del color actualizado en <1 navegación (router.refresh en PUT success)

### Out of Scope
- Crear contexto global de espacio activo (se mantiene URL-driven)
- Modificar el schema de Prisma (campo `color` ya existe)
- Cambios en API de espacios

## Capabilities

### New Capabilities
- `visual-identity-espacio`: La identidad visual del espacio (color) se muestra en 4 puntos de la UI — sidebar band, switcher marker, scope-bar icon, y project card top border

### Modified Capabilities
- Ninguno — es cambio puramente visual/presentacional

## Approach

**URL-based + props drilling (Approach A del exploration)**

Cada page recibe `espacioId` de la URL, hace fetch del espacio completo (con `color`) en Server Component, y pasa `espacio.color` como prop a los componentes que lo renderizan.

| Punto visual | Componente | Cómo recibe el color |
|---|---|---|
| `client-band` | `ClientBand` | `useParams()` en layout → fetch color → prop |
| `sw-mark` | `EspacioSwitcher` | `espacios[]` con color pasado como prop |
| `scope-bar` | `ScopeBar` | `espacioNombre` + `espacioColor` como props |
| `border-top` | `ProyectoCard` | `espacioColor?: string` como prop opcional |

**Propagación**: `EspaciosForm` hace `router.refresh()` en `onSuccess` del PUT — Next.js re-fetcha el Server Component padre y todos los puntos visuales reflejan el color nuevo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/ui/client-band.tsx` | New | Franja vertical 3px en borde derecho del sidebar |
| `components/ui/espacio-switcher.tsx` | New | Dropdown switcher con `sw-mark` de color por espacio |
| `components/ui/scope-bar.tsx` | New | Barra superior con ícono de color + nombre espacio |
| `components/proyectos/proyecto-card.tsx` | Modified | Agregar `border-top: 3px solid` con `espacioColor` |
| `app/(dashboard)/layout.tsx` | Modified | Montar `ClientBand` y `EspacioSwitcher` |
| `app/(dashboard)/espacios/[id]/proyectos/page.tsx` | Modified | Pasar `espacio.color` a `ScopeBar` y `ProyectoCard` |
| `app/(dashboard)/proyectos/page.tsx` | Modified | Pasar `espacio.color` a cada `ProyectoCard` |
| `app/(dashboard)/casos/page.tsx` | Modified | Agregar `ScopeBar` en header |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Props drilling en cadena larga | Low | Solo 1-2 niveles; aceptable para la codebase |
| Hard refresh rompe indicador visual | Low | No hay estado global que perder; todo viene de URL/BD |
| CSS custom property dinámica (color arbitrary) | Low | Usar `style={{ backgroundColor }}` en lugar de `className` |

## Rollback Plan

`git revert <commit-hash>` del commit de implementación revierte todos los cambios de UI. El schema de Prisma y APIs no se tocaron.

## Dependencies

- Prisma schema `Espacio.color` (ya existe — HU-2.1)
- Color picker existente (`components/ui/color-picker.tsx`)

## Success Criteria

- [ ] `ClientBand` visible como franja 3px en borde derecho del sidebar cuando hay espacio activo
- [ ] `EspacioSwitcher` muestra `sw-mark` (9×9px) del color correspondiente a cada espacio
- [ ] `ScopeBar` muestra ícono 8×8px con el color del espacio activo
- [ ] `ProyectoCard` muestra `border-top: 3px solid` con el color del espacio
- [ ] Cambiar color de espacio vía `PUT /api/espacios/[id]` refleja el nuevo color en la siguiente navegación
