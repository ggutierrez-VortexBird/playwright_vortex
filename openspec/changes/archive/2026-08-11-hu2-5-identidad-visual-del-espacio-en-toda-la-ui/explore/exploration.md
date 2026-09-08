# Exploration: HU-2.5 — Identidad visual del espacio en toda la UI

## Current State

### Prisma schema: Espacio.color YA EXISTE
El modelo `Espacio` en `prisma/schema.prisma` (línea 57-67) tiene el campo `color String` definido. No se requiere变更 de schema.

### Color picker YA EXISTE y funciona
`components/ui/color-picker.tsx` es un componente completo con:
- 8 colores predefinidos (incluyendo `--client: #C9822F`)
- Selección visual con `aria-pressed` y `aria-label` para accesibilidad
- Integración con `EspaciosForm` (`app/(dashboard)/espacios/espacios-form.tsx`) que guarda el color via API

### Dashboard layout es completamente estático
`app/(dashboard)/layout.tsx` (líneas 26-92) renderiza un sidebar hardcodeado:
- Sin referencia a `Espacio` ni `color`
- Los dots de navegación usan colores estáticos (`bg-seal`, `bg-client`, `bg-amber`, `bg-param`)
- **NO hay contexto de espacio activo**
- **NO hay componente switcher**
- **NO hay client-band**

### Ningún componente visual de HU-2.5 existe todavía
| Componente del mockup | Archivo mockup | Implementación actual |
|---|---|---|
| `client-band` (franja sidebar) | `acta-mockups.html` línea 282: `position:absolute; top:0; right:0; width:3px; height:100%; background:var(--client)` | ❌ No existe |
| `sw-mark` (marcador switcher) | `acta-mockups.html` línea 286: `width:9px; height:9px; border-radius:2px; background:var(--client)` | ❌ No existe |
| `scope-bar` (topbar) | `acta-mockups.html` línea 313-314: `.scope-bar i{width:8px; height:8px; border-radius:2px; background:var(--client)}` | ❌ No existe |
| `border-top` proyecto-card | `acta-mockups.html` línea 306: `border-top:3px solid` con color dinámico | ❌ No existe — `ProyectoCard` tiene `border border-rule` genérico |

### Navegación por URL, sin espacio activo global
- `/espacios/[id]/proyectos` → obtiene espacio por `params.id` del server component
- `/proyectos` → lista todos los espacios y proyectos, pero **ningún espacio está "activo" globalmente**
- `/casos` → lista todos los casos sin filtrar por espacio (agrupados por proyecto)
- **No existe noción de "espacio activo de la sesión"**

### Patrones de la codebase
- Server Components para pages + Client Components para forms/lists
- Types en `types/{entidad}.ts` (ya existe `types/espacio.ts` con `Espacio`, `CreateEspacioInput`, `UpdateEspacioInput`)
- CSS variables en `:root` de `globals.css` (`--client: #c9822F`)
- Tailwind configurado con colores semánticos (`bg-client`, `text-client`, etc.)

---

## Affected Areas

| Archivo / Directorio | Por qué está afectado |
|---|---|
| `app/(dashboard)/layout.tsx` | Agregar `client-band` (franja vertical) y componente `EspacioSwitcher` al sidebar. Necesita acceso al espacio activo. |
| `app/(dashboard)/espacios/[id]/proyectos/page.tsx` | Ya pasa `espacio.color` al header (línea 84-88). Necesita propagar el color al `scope-bar` y a las tarjetas de proyecto. |
| `app/(dashboard)/proyectos/page.tsx` + `proyectos-client.tsx` | Muestra proyectos agrupados por espacio. Necesita pasar `espacio.color` a cada `ProyectoCard`. |
| `app/(dashboard)/casos/page.tsx` + `casos-client.tsx` | Necesita un `scope-bar` en el header que muestre el espacio activo y su color. |
| `components/proyectos/proyecto-card.tsx` | Necesita `border-top` de 3px con `border-top-color` tomada del espacio. Requiere recibir `espacioColor?: string`. |
| `components/ui/scope-bar.tsx` | NUEVO — componente `scope-bar` para el header: ícono de color + nombre del espacio. |
| `components/ui/espacio-switcher.tsx` | NUEVO — dropdown switcher de espacio en sidebar (equivalente a `switcher` del mockup). |
| `components/ui/client-band.tsx` | NUEVO — franja vertical de 3px en el borde derecho del sidebar. |
| `contexts/espacio-context.tsx` | NUEVO — React context para el espacio activo (lectura desde URL o cookie de sesión). |
| `types/espacio.ts` | Ya existe. Opcional: agregar `EspacioWithColor` si se necesita. |
| `app/globals.css` | Ya tiene `--client`. Si se quiere arbitrary colors por espacio, no se puede hardcodear en CSS. Se requiere inline style o CSS custom property dinámico. |
| `tailwind.config.ts` | No requiere cambios. Los colores semánticos ya están definidos. |

---

## Visual Points Where Space Color Must Appear

Según los mocks y AC de HU-2.5, el color del espacio activo debe aparecer en **4 puntos**:

1. **`client-band`** — Franja vertical de 3px en el borde derecho del sidebar (mockup línea 282)
   - Selector: `.rail > .client-band { background: var(--client) }`
   - Implementación: `<span class="client-band" style="background: {activeEspacioColor}" />`

2. **`sw-mark`** — Marcador de 9×9px junto al nombre del espacio en el switcher (mockup línea 286)
   - Selector: `.sw-mark { background: var(--client) }`
   - Implementación: en `EspacioSwitcher`, cada item muestra su color como `sw-item i`

3. **`scope-bar`** — Ícono de 8×8px en la barra superior (mockup línea 313-314)
   - Selector: `.scope-bar i { background: var(--client) }`
   - Implementación: `<span class="scope-bar"><i style="background:{color}"></i> {espacioNombre}</span>`

4. **`border-top` proyecto-card** — Borde superior de 3px en la tarjeta (mockup línea 306)
   - Selector: `.pc-top { border-top: 3px solid }`
   - Implementación: `<div class="pc-top" style="border-top-color: {espacioColor}">`

**AC-2 (propagación en <1 navegación)**: cualquier cambio de color en `Espacio` via API `PUT /api/espacios/[id]` debe reflejarse en la siguiente navegación a cualquier página que use ese espacio.

---

## Approaches

### Approach A: URL-based + props drilling (mínimo acoplamiento)

**Descripción**: Cada page recibe el `espacioId` de la URL (`/espacios/[id]/proyectos`), hace fetch del espacio completo (incluyendo `color`) en el Server Component, y pasa `espacio.color` como prop a los componentes que lo necesitan. No se introduce contexto global.

| | |
|---|---|
| **Pros** | Mínimo acoplamiento; coincide con patrón URL-params ya usado; fácil de trackear en tests e2e; no hay "estado fantasma" de espacio activo |
| **Cons** | Props drilling en cadena larga (layout → header → scope-bar); cada page debe saber su espacio; no hay "espacio activo global" para el switcher que persa entre navegación |
| **Effort** | **Low-Medium** |

**Detalles de implementación**:
- `layout.tsx` no tiene noción de espacio activo — sigue siendo estático
- Se crea `ScopeBar` component que recibe `espacioNombre` y `espacioColor` como props
- `EspacioSwitcher` se monta en `/espacios` y `/proyectos` (páginas que listan múltiples espacios), recibe array de espacios y maneja la selección
- `ProyectoCard` recibe `espacioColor` como prop opcional

### Approach B: React Context para espacio activo

**Descripción**: Crear `EspacioContext` con `activeEspacio: Espacio | null` y `setActiveEspacio`. El layout lee de la URL el espacio activo y lo guarda en contexto. Todos los componentes consumidores leen del contexto.

| | |
|---|---|
| **Pros** | No hay props drilling; el color está disponible en todo el tree; switcher puede actualizar contexto y toda la UI responde |
| **Cons** | Acoplamiento fuerte entre layout y contexto; implementación de context es más código; el "active espacio" no está persistence — se pierde en hard refresh; mezclas con el patrón URL-params existente |
| **Effort** | **Medium** |

### Approach C: Cookie/session para espacio activo (persistente)

**Descripción**: Similar a B pero el espacio activo se guarda en la cookie de sesión (`acta_session` en iron-session). Cuando el usuario cambia de espacio via switcher, se actualiza la cookie y se hace `router.refresh()`. El layout lee la cookie en cada request.

| | |
|---|---|
| **Pros** | Espacio activo persiste en hard refresh; compatible con el sistema de auth existente; toda la UI responde sin props drilling |
| **Cons** | Más complejo (actualizar cookie + router.refresh en cada cambio); misma página puede tener 2 espacios activos en diferentes tabs; el switcher necesita form/post o API call para actualizar cookie |
| **Effort** | **Medium-High** |

---

## Recommendation

**Approach A (URL-based + props drilling)** con un **complemento**:

1. **ScopeBar y ProyectoCard** reciben `espacioColor` via props (del Server Component que hace fetch del espacio por URL params). Esto cubre los puntos 3 y 4 del AC.

2. **ClientBand y EspacioSwitcher** se implementan como componentes independientes que:
   - En `/espacios` y `/proyectos` (múltiples espacios): el switcher permite seleccionar. No hay "activo" — se usa hover/click para filtrar visual.
   - En `/espacios/[id]/proyectos` y `/proyectos/[id]/casos` (espacio único en URL): el layout muestra el `client-band` con el color del espacio de la URL. El switcher muestra el espacio actual con su color.
   
3. **El `client-band` se calcula en el layout** así:
   - Leer `params.id` del child route ( Next.js `useSelectedLayoutSegments` o `useParams`)
   - Si hay un espacio en la URL, hacer fetch de su color y aplicar `client-band`
   - Si no hay espacio en URL (ej: `/proyectos` global), no mostrar `client-band`

4. **Propagación del color**: cuando `EspaciosForm` guarda un nuevo color via `PUT /api/espacios/[id]`, el `onSuccess` hace `router.refresh()` — Next.js re-fetcha el Server Component padre, que obtiene el color actualizado de Prisma, y todos los componentes con el nuevo color se renderizan. Cumple AC-2.

**Por qué no Approach B o C**:
- No hay requerimiento de "sesión persistente de espacio" — el usuario navega por URLs, no hay noción de "trabajar en el espacio Bancoomeva" como estado global.
- El mockup muestra el switcher como un dropdown de selección, no como un indicador de estado global.
- Approach A es consistente con el resto del codebase (URL-driven, no global state).

---

## Risks

1. **Hard refresh rompe switcher (si se implementara contexto)**: el espacio activo se perdería. Con Approach A esto no ocurre porque todo viene de la URL.

2. **Múltiples espacios en diferentes tabs**: si el usuario tiene 2 tabs con espacios diferentes, cualquier solución de contexto global fallaría. La URL-based approach funciona correctamente.

3. **Prop drilling en `/proyectos` global**: `proyectos-client.tsx` recibe `espacios[]` con `color`. Pasa `color` a cada `ProyectoCard`. Es un nivel de drilling aceptable (1 nivel).

4. **Performance**: el `client-band` en el layout requeriría fetching del espacio activo en cada navegación. Se mitiga con Next.js caching (el fetch de `getEspacioById` se revalida en cada navegación).

5. **SSR del layout**: el layout es un Server Component async. Necesita leer params de la child route para saber el espacio activo. Next.js permite `params` en layout, pero hay que verificar que `useSelectedLayoutSegments` o `useParams` funcione en server component context.

6. **CSS custom property dinámica**: si el color es arbitrary (cualquier hex), no se puede usar `--client` como variable CSS estática. Se requiere `style={{ backgroundColor: espacio.color }}` en lugar de `className="bg-client"`.

---

## Ready for Proposal

**Sí.**

El scope está claro: 4 puntos visuales, 4 componentes nuevos (`ClientBand`, `EspacioSwitcher`, `ScopeBar`, y modificación de `ProyectoCard`). El modelo de datos ya tiene `Espacio.color`. La propagación es manejable con URL-based approach que no requiere estado global.

**Decisiones para el proposal**:
1. Confirmar si el `client-band` aparece solo en páginas con espacio en URL (enfoque recomendado) o en todas las páginas del dashboard.
2. Confirmar si el `EspacioSwitcher` permite cambiar de espacio (navegando a `/espacios/[id]/proyectos`) o solo muestra el espacio actual cuando ya hay uno activo.
3. Si el `EspacioSwitcher` tiene dropdown, ¿los items muestran todos los espacios o solo los del usuario actual?
