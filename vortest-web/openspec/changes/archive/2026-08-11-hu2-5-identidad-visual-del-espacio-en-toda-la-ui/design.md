# Design: HU-2.5 — Identidad visual del espacio en toda la UI

## Technical Approach

Implementar los 4 puntos visuales del color de espacio (ClientBand, sw-mark, scope-bar, border-top proyecto) usando **URL-based props drilling** recomendado por el EXPLORER. Cada página fetchpea `espacio.color` desde Prisma en Server Component y lo pasa como prop a los componentes que lo renderizan. No se introduce contexto global.

## Architecture Decisions

### Decision: Props drilling vs Context para el color del espacio

**Choice**: URL-based props drilling
**Alternatives considered**: React Context (`EspacioContext`), Cookie/session con iron-session
**Rationale**: Mínimo acoplamiento con el resto del codebase (URL-driven, no global state). El mockup muestra el switcher como dropdown de selección, no indicador de estado global. Props drilling es 1-2 niveles, aceptable.

### Decision: ClientBand en layout.tsx — cómo obtener el espacio activo

**Choice**: `useSelectedLayoutSegments` en Server Component para detectar si hay `espacio/[id]` en la URL, luego fetch del color en el server
**Alternatives considered**: `useParams` en Client Component, cookie de sesión
**Rationale**: El layout es un Server Component async; `useSelectedLayoutSegments` (hook de Next.js) permite leer los segmentos de la URL hijo. El fetch se hace en el server, evitando waterfalls. No requiere estado global.

### Decision: Fallback cuando `espacio.color` es null/undefined

**Choice**: No renderizar el elemento visual (band, mark, icon, border) cuando color es null/undefined
**Rationale**: Comportamiento por defecto natural — si el espacio no tiene color, no se muestra marca. Es consistente con el spec: "ClientBand NO muestra franja de color".

### Decision: Estilo del color dinámico

**Choice**: `style={{ backgroundColor: espacioColor }}` en lugar de CSS class con `--client`
**Alternatives considered**: CSS custom properties dinámicas, Tailwind arbitrary values
**Rationale**: Los colores son arbitrary (cualquier hex de los 8 predefinidos). No se pueden hardcodear en CSS. `style` inline es la forma más directa y SSR-safe.

### Decision: EspaciosForm — refresh strategy

**Choice**: Reemplazar `window.location.reload()` por `router.refresh()` de `next/navigation`
**Rationale**: `router.refresh()` hace soft refresh — revalida los Server Components afectados sin full reload. Cumple el AC de propagación "<1 navegación".

## Data Flow

```
URL: /espacios/[id]/proyectos
        │
        ▼
page.tsx (Server Component)
  ├─ getEspacioById(id) ──→ Prisma: Espacio { color }
  │
  ├─ <ScopeBar espacioNombre={nombre} espacioColor={color} />
  │
  └─ <ProyectoGrid espacioId={id} espacioNombre={nombre} espacioColor={color} ...>
        │
        ▼
  ProyectoGrid (Client Component)
  └─ <ProyectoCard proyecto={p} espacioNombre={nombre} espacioColor={color} />
        │
        ▼
  ProyectoCard
    └─ <div style={{ borderTopColor: espacioColor }}>  ← solo si espacioColor existe
```

Para `ClientBand` en layout:
```
layout.tsx (Server Component)
  ├─ useSelectedLayoutSegments() → ['espacios', '[id]'] (si aplica)
  │
  └─ getEspacioById(segments[1]) → Prisma: Espacio { color }
      │
      └─ <ClientBand espacioColor={color} />
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/ui/client-band.tsx` | Create | Franja vertical 3px en borde derecho del sidebar. Server component, usa `useSelectedLayoutSegments` para detectar espacio activo. |
| `components/ui/espacio-switcher.tsx` | Create | Dropdown switcher con `sw-mark` de color por espacio. Client component con estado `isOpen`. |
| `components/ui/scope-bar.tsx` | Create | Barra superior: ícono 8×8px + nombre del espacio. Client component. Props: `espacioNombre`, `espacioColor`. |
| `components/proyectos/proyecto-card.tsx` | Modify | Agregar `espacioColor?: string` prop. Renderizar `border-top: 3px solid` con `borderTopColor` solo si está definido. |
| `app/(dashboard)/layout.tsx` | Modify | Importar y montar `ClientBand` (en `<aside>`) y `EspacioSwitcher` (en nav). Ambos obtienen `espacio.color` via fetch en server. |
| `app/(dashboard)/espacios/[id]/proyectos/page.tsx` | Modify | Ya tiene `espacio.color` — pasar `espacioColor` a `ScopeBar` y a `ProyectoGrid`. |
| `app/(dashboard)/proyectos/proyectos-client.tsx` | Modify | Pasar `espacio.color` a cada `ProyectoCard` dentro del map de espacios. |
| `app/(dashboard)/casos/page.tsx` | Modify | Pasar `espacioNombre` y `espacioColor` a `ScopeBar` (ubicado en el header de la página). |
| `app/(dashboard)/espacios/espacios-form.tsx` | Modify | Reemplazar `window.location.reload()` con `router.refresh()` del `useRouter` de `next/navigation`. |

## Components Detail

### `ClientBand`
```tsx
// components/ui/client-band.tsx
// Server Component — usa useSelectedLayoutSegments para detectar espacio en URL
// Props: ninguna (self-contained)
// Renderiza: <span> posicionado absolute en el borde derecho del sidebar
```

### `EspacioSwitcher`
```tsx
// components/ui/espacio-switcher.tsx
// Client Component ('use client')
// Props: { espacios: Espacio[] }
// Estados: isOpen (dropdown)
// Renderiza: botón con sw-mark del espacio activo + panel con todos los espacios
```

### `ScopeBar`
```tsx
// components/ui/scope-bar.tsx
// Client Component ('use client')
// Props: { espacioNombre: string; espacioColor?: string }
// Renderiza: <div className="scope-bar"><i></i> {espacioNombre}</div>
// Si espacioColor es null/undefined, no renderiza el <i> con color
```

### `ProyectoCard` (modificado)
```tsx
// Props existentes + nuevo:
espacioColor?: string

// En el div.prj-card, agregar:
style={espacioColor ? { borderTopColor: espacioColor } : undefined}
// Y en CSS: border-top: 3px solid transparent (por defecto)
```

## Open Questions

- [ ] **EspacioSwitcher en `/proyectos`**: ¿debe permitir cambiar de espacio (navegando a `/espacios/[id]/proyectos`) o solo mostrar el espacio actual? El mockup muestra un dropdown con items clickeables.
- [ ] **`/casos` sin espacio en URL**: Esta página lista todos los casos sin filtrar por espacio. ¿Debería mostrar un `ScopeBar` genérico sin color, o no mostrar `ScopeBar` en absoluto?
- [ ] **SSR de `useSelectedLayoutSegments`**: Necesita verificarse que funciona en un Server Component async de Next.js 14+. Si no funciona, se usará un approach alternativo (ej: middleware que setea header con espacio activo).
