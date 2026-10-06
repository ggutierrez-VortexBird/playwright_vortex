# Auditoría UX Heuristics — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: ux-heuristics (Nielsen + Krug), design-taste-frontend, high-end-visual-design
**Modo**: code-based (el dev server no está corriendo; se auditó markup y componentes)
**Rutas auditadas**: /login, /, /espacios, /proyectos, /casos, /ejecuciones, /credenciales, /usuarios, /perfil, /casos/grabar (y sub-rutas)

---

## Resumen ejecutivo

- **Total issues**: 28
- **Severidad alta**: 4 (visibilidad, error prevention, consistencia)
- **Severidad media**: 14
- **Severidad baja**: 10
- **Top 3 issues**:
  1. **Nielsen #1 / Krug "don't make me think"**: el login muestra `state.error` con mensaje plano sin contexto de qué campo falló ni cómo corregirlo
  2. **Nielsen #5**: no hay `beforeunload` / warning de "unsaved changes" en PerfilClient (se pueden perder cambios de nombre y contraseña)
  3. **Nielsen #4**: inconsistencia grave en headers de página — `/usuarios`, `/credenciales`, `/casos` usan el patrón `-mx-4 -mt-4` inline, mientras que `/espacios`, `/proyectos` delegan al client component
- **Patrones sistemáticos detectados**:
  - 5 páginas redefinen headers a mano en lugar de usar un `<PageHeader>` primitivo compartido
  - Icons hand-rolled SVG en lugar de Phosphor/HugeIcons (espacios-client.tsx, user-menu, mobile-menu-button, global-search, espacio-switcher)
  - Inter como única fuente (viola design-taste-frontend que pide Geist/Outfit/Satoshi)
  - `transition-opacity` usado solo en botones, sin `duration-*` explícito (Spring Physics nula)

---

## Quick Diagnostic Score

**Puntuación actual: 5/10**

| Pregunta | Respuesta | Implicación |
|----------|-----------|-------------|
| ¿Puedo saber en qué sitio/página estoy inmediatamente? | Parcial | El logo dice "vorTest" pero falta tagline consistente en todas las páginas |
| ¿La acción principal es obvia? | No | No hay jerarquía visual clara en ningún header de página |
| ¿La navegación es clara? | No | 4 de 7 rutas del sidebar no se sabe "dónde están" sin texto (mystery meat en icon-only rail) |
| ¿Puedo encontrar search? | Sí | GlobalSearch visible en header, implementación correcta |
| ¿El sistema muestra lo que está pasando? | No | No hay loading skeletons, solo contenido flash |
| ¿Los mensajes de error son útiles? | No | Error messages genéricos o sin acción sugerida |
| ¿Puedo undo o volver atrás? | No | No hay undo en ninguna acción destructiva |
| ¿Funciona sin hover? | Parcial | Algunos hover-only tooltips sin fallback visible |
| ¿Todos los elementos interactivos están etiquetados? | No | Icon-only buttons sin aria-label en algunos casos |
| ¿Algo me hace decir "¿eh?"? | Sí | `ROL_LABEL` con explicaciones paternalistas ("acceso completo", "administra sus espacios") |

---

## Tabla de issues

| # | Severidad | Ruta | Heurística violada | Descripción | Evidencia (archivo:línea) | Fix sugerido |
|---|-----------|------|-------------------|-------------|---------------------------|--------------|
| 1 | alta | /login | Nielsen #9 | El error de login muestra `state.error` genérico. El usuario no sabe si falló el email, la contraseña, o la cuenta | `login-form.tsx:53-56` | Mostrar mensaje específico por campo: "Contraseña incorrecta" / "Usuario no encontrado". Validar en blur, no en submit |
| 2 | alta | /perfil | Nielsen #5 | No hay warning de "unsaved changes" cuando el usuario modifica nombre o contraseña y hace navigate away | `perfil-client.tsx:20-88` | Agregar `useBeforeUnload` o implementar dirty-state tracking con confirmación antes de navegar |
| 3 | alta | TODAS | Nielsen #4 | Inconsistencia de headers: 5 páginas usan `-mx-4 -mt-4 border-b bg-surface px-4 py-3` inline vs. otras que no. No hay `<PageHeader>` primitivo compartido | `usuarios/page.tsx:19`, `credenciales/page.tsx:40`, `casos/casos-client.tsx:85` | Crear `<PageHeader>` component con `title`, `description`, `actions` props |
| 4 | alta | /login | Nielsen #1 | El login muestra "Iniciando sesión..." en el botón pero no hay loading spinner visual. El usuario no sabe si está procesando o colgado | `login-form.tsx:58-64` | Agregar spinner icon en botón disabled + deshabilitar inputs durante submission |
| 5 | media | /espacios | Nielsen #8 | La card de espacio usa `rounded-lg border shadow-card hover:shadow-card-hover` pero el `hover` solo cambia la sombra — la card parece inmóvil. Violación de "micro-interaction is missing" | `espacios-client.tsx:72` | Hover state debe incluir translate-Y(-2px) + scale(1.01) para feedback táctil |
| 6 | media | TODAS | Krug "don't make me think" | Los 7 nav items usan icon-only en tablet rail (md:w-[72px]). Iconos: `home`, `share`, `folder_open`, `fact_check`, `play_circle`, `vpn_key`, `group`. Tester no sabe qué es `vpn_key` = Credenciales (oculto para su rol de todas formas) | `sidebar-nav.tsx:52-58` | Tooltip accesible en hover/focus para cada icono. O labels siempre visibles |
| 7 | media | /casos | Nielsen #6 | La tabla de casos no tiene column sorting visible. Usuario tiene que recordar el schema para saber qué columna es qué | `casos/casos-client.tsx:140` (CasoTable) | Agregar `<th>` con `aria-sort` y botones de sort en headers |
| 8 | media | /home | Nielsen #8 | El dashboard muestra "Hola, {email}" en `text-m3-primary` — el email es el rol más visible, no el nombre. Parece un sistema, no una persona | `page.tsx:80` | Mostrar `nombre` del usuario, no el email, como saludo principal |
| 9 | media | /credenciales | Nielsen #9 | Las credenciales son PLACEHOLDER hardcodeado. No hay estado vacío real, no hay loading, no hay error. Se pierde todo el flow de "agregar credencial" | `credenciales/page.tsx:10-26` | Implementar query real de credenciales + empty state funcional |
| 10 | media | /espacios | Nielsen #6 | La card de espacio muestra "hace X min" / "hace Xd" — el tooltip en el avatar solo muestra el email completo en `title={m.email}`. Pero en mobile touch no hay hover | `espacios-client.tsx:175-178` | Popover accesible en focus/tap para email completo del admin |
| 11 | media | /espacios | Nielsen #7 | View mode toggle (grid/list) no tiene estado persistente. Si cambio a list y navego a otra página y vuelvo, vuelve a grid. No hay preference guardada | `espacios-client.tsx:330-355` | Guardar preference en localStorage |
| 12 | media | /perfil | Nielsen #1 | La página de perfil dice "Tu correo es {email} y no se puede cambiar desde aquí" — el "desde aquí" es confuso. ¿Significa que SI se puede cambiar desde otro lugar? | `perfil-client.tsx:96-97` | Reescribir: "Tu correo es {email}. Para cambiarlo, contacta a un administrador." |
| 13 | media | /login | Nielsen #2 | El label del formulario es "Correo electrónico" pero el campo usa `type="email"` + `autocomplete="email"`. El placeholder está ausente. El usuario no tiene ejemplo de formato | `login-form.tsx:26-35` | Agregar `placeholder="tu@email.com"` |
| 14 | media | /espacios | Nielsen #4 | El código de espacio se muestra como `#ESP-{id}` en la card pero como `#ESP-{id}` en la row. Sin embargo en la card el código usa `font-mono-code text-[11px]` y en la row `font-mono-code text-[11px]`. Inconsistencia visual mínima pero existe | `espacios-client.tsx:78` y `espacios-client.tsx:227` | Unificar: el código siempre en monoespaciada + mismo tamaño |
| 15 | media | /home | Nielsen #1 | La actividad reciente usa `font-mono-code` para la ruta del proyecto (espacio.nombre · proyecto.nombre · fecha). Esto parece technical output, no UI legible | `page.tsx:219-222` | Cambiar a `font-body text-body-sm` |
| 16 | media | /espacios | Nielsen #3 | El botón "Entrar →" en EspacioCard y EspacioRow navega a `/espacios/{id}/proyectos` — no hay breadcrumb ni forma de volver a la lista de espacios. Violación de "emergency exit" | `espacios-client.tsx:311` | Agregar back button o breadcrumb en `/espacios/[id]/proyectos` |
| 17 | media | /home | Nielsen #8 | Los 4 stat cards usan `rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-card`. Son 4 cards idénticas en grid — sin jerarquíavisual que privilegie una sobre otra. Todo es igualmente "importante" | `page.tsx:88-127` | Considerar que "Tasa de éxito" es el metric más importante para un tester — debería tener mayor peso visual |
| 18 | media | /credenciales | Nielsen #5 | El botón "Agregar credencial" no hace nada (es placeholder). Pero el usuario no sabe eso hasta que hace click. No hay tooltip "Próximamente" o similar | `credenciales/page.tsx:44` | Deshabilitar con tooltip o reemplazar con estado disabled con mensaje |
| 19 | media | /usuarios | Nielsen #5 | La página usuarios no tiene búsqueda local. Si hay 50 usuarios, el admin tiene que scrollear todo. Violación directa de Nielsen #6 | `usuarios/page.tsx:28` | Agregar `<input>` de búsqueda filtrando la lista client-side |
| 20 | baja | /login | Nielsen #8 | El login tiene un Logo + tagline "Automatización de pruebas" centrado. Pero el form usa max-w-sm. El Logo queda desbalanceado con tanto espacio vertical vacío alrededor | `login/page.tsx:20-26` | Compactar: Logo + tagline más cerca del form, menos espacio vertical |
| 21 | baja | /home | Nielsen #8 | La barra de distribución de resultados usa `display: flex-row` con colores en hardcoded hex en lugar de tokens M3 (`ESTADO_COLOR`). Si el tema cambia, los colores se rompen | `page.tsx:24-32` | Mapear a tokens M3 o CSS variables |
| 22 | baja | TODAS | Nielsen #4 | Los SVG icons hand-rolled (espacios-client, user-menu, mobile-menu-button, global-search, espacio-switcher) no siguen la convención `material-symbols-outlined` del resto de la UI | Múltiples archivos | Reemplazar con Phosphor icons para consistencia con el sistema M3 |
| 23 | baja | /perfil | Nielsen #3 | La acción de cambiar contraseña tiene validación client-side (`nueva.length < 8`) pero SI el server falla, el form NO preserva `actual` ni `nueva`. Solo `confirmar` se preserva. El usuario tiene que re-ingresar todo | `perfil-client.tsx:75-82` | Preservar `actual` y `nueva` en error state |
| 24 | baja | /home | Nielsen #1 | Las labels de los stat cards usan `uppercase tracking-wide text-m3-on-surface-variant`. "Proyectos", "Casos de prueba", "Ejecuciones" — las mayúsculas NO SON AUTO-EVIDENT. Requieren un extra segundo de procesamiento | `page.tsx:89` | Cambiar a title case "Proyectos", "Casos de prueba" |
| 25 | baja | /espacios | Nielsen #6 | El pagination dice "Mostrando X de Y espacios registrados" — "registrados" es un verbo en tiempo pasado. Suena a que fueron archivados. Debería decir "creados" | `espacios-client.tsx:390-391` | Cambiar a "Mostrando X de Y espacios" |
| 26 | baja | /espacios | Krug "don't make me think" | El toggle grid/list muestra ambas opciones sin contexto de cuál es la actual. La activa tiene "bg-white shadow-sm" — un círculo de luz sería más claro que un rectángulo | `espacios-client.tsx:334` | Usar toggle pills con indicator deslizable |
| 27 | baja | /credenciales | Nielsen #8 | El badge "Sesión activa" vs "Requiere ingreso" usa `bg-m3-tertiary-container` vs `bg-m3-surface-container-high`. No hay estado "loading" para cuando la sesión se está renovando | `credenciales/page.tsx:62-69` | Agregar estado `renewing` con spinner inline |
| 28 | baja | /espacios | Nielsen #3 | El botón "Eliminar" espacio tiene `onClick={() => onDelete(espacio)}` pero NO hay confirmación antes de delete. Se borra directamente | `espacios-client.tsx:109` | Antes de ejecutar delete real, mostrar ConfirmDialog |

---

## Issues por heurística

### Nielsen #1 — Visibility of system status
- **Issue #4** (alta): Login no muestra spinner durante submission
- **Issue #8** (media): Dashboard greeting muestra email, no nombre
- **Issue #12** (media): Perfil copy confusa ("desde aquí")
- **Issue #15** (media): Monospace en metadata de actividad reciente
- **Issue #24** (baja): Labels en uppercase requieren procesamiento extra

### Nielsen #2 — Match between system and real world
- **Issue #13** (media): Form login sin placeholder
- **Issue #22** (baja): SVG icons hand-rolled vs icon library

### Nielsen #3 — User control and freedom
- **Issue #16** (media): Navegación a espacio no tiene breadcrumb/back
- **Issue #23** (baja): Form password no preserva campos en error
- **Issue #28** (baja): Delete de espacio sin confirmación

### Nielsen #4 — Consistency and standards
- **Issue #3** (alta): Headers inconsistentes entre páginas
- **Issue #14** (media): Estilos de código de espacio inconsistentes
- **Issue #22** (baja): SVG icons no siguen convención M3
- **Issue #26** (baja): Toggle grid/list sin indicador claro

### Nielsen #5 — Error prevention
- **Issue #2** (alta): Perfil sin unsaved-changes warning
- **Issue #7** (media): Tabla casos sin sorting visible
- **Issue #18** (media): Botón "agregar credencial" sin disabled state
- **Issue #19** (media): Página usuarios sin búsqueda local
- **Issue #28** (baja): Delete sin confirmación

### Nielsen #6 — Recognition rather than recall
- **Issue #6** (media): Icon-only nav sin labels en tablet
- **Issue #10** (media): Emails de admins sin fallback en touch
- **Issue #19** (media): Sin búsqueda local en usuarios

### Nielsen #7 — Flexibility and efficiency of use
- **Issue #11** (media): View mode preference no persistente

### Nielsen #8 — Aesthetic and minimalist design
- **Issue #5** (media): Card hover sin feedback táctil
- **Issue #17** (media): 4 stat cards sin jerarquía
- **Issue #20** (baja): Login page desbalanceado
- **Issue #21** (baja): Hardcoded hex colors en vez de tokens
- **Issue #27** (baja): Badge sin estado loading

### Nielsen #9 — Help users recognize, diagnose, recover from errors
- **Issue #1** (alta): Error login genérico
- **Issue #9** (media): Credenciales placeholder sin flow real

### Nielsen #10 — Help and documentation
- No se encontraron issues críticos. La app tiene roles claros en `lib/roles.ts`.

---

### Krug — Don't make me think
- **Issue #6**: Nav icon-only en tablet
- **Issue #24**: Labels en uppercase
- **Issue #25**: "espacios registrados" sounds passive/archived
- **Issue #26**: Grid/list toggle confuso

### Krug — How we read on the web (scanning)
- **Issue #15**: Metadata en monospace dificulta scanning
- **Issue #17**: 4 cards idénticas sin jerarquía = scanning no diferenciado

### Krug — Don't design for everybody
- **Issue #10**: Tooltip hover-only excluye mobile/touch users

---

## Top 5 issues prioritarios

### 1. Login error sin contexto (Nielsen #9, Severity: alta)
**Dónde**: `login-form.tsx:53-56`
**Qué**: `state.error` se muestra como string plano. El usuario no sabe si el error es email inválido, contraseña incorrecta, o cuenta no encontrada.
**Por qué es crítico**: Es la puerta de entrada al sistema. Si el usuario no puede entender qué falló, no puede recuperarse.
**Fix**:
```tsx
// En el server action, retornar errores específicos por campo
{ field: "email", message: "Usuario no encontrado" }
{ field: "password", message: "Contraseña incorrecta" }
// En el form, mostrar error junto al campo específico
{state.fieldError === "email" && <p>Usuario no encontrado</p>}
{state.fieldError === "password" && <p>Contraseña incorrecta</p>}
```

### 2. Unsaved changes en Perfil (Nielsen #5, Severity: alta)
**Dónde**: `perfil-client.tsx`
**Qué**: Si el usuario modifica su nombre o contraseña y hace click en cualquier link antes de guardar, los cambios se pierden sin warning.
**Por qué es crítico**: Cambios de password especialmente son dolorosos de re-ingresar.
**Fix**: Implementar dirty-state tracking:
```tsx
const [isDirty, setIsDirty] = useState(false);
// useEffect + window.onbeforeunload
useEffect(() => {
  if (isDirty) {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }
}, [isDirty]);
```

### 3. Inconsistencia de headers (Nielsen #4, Severity: alta)
**Dónde**: `usuarios/page.tsx:19`, `credenciales/page.tsx:40`, `casos/casos-client.tsx:85`, `espacios/page.tsx:46-53`
**Qué**: 5 patrones diferentes para headers de página. Algunos usan `-mx-4 -mt-4` en el page.tsx, otros delegan al client component, otros usan `flex wrap items-center gap-4 border-b`. No hay `<PageHeader>` component.
**Por qué es crítico**: Inconsistencia viola Nielsen #4. Cada página parece de un producto diferente.
**Fix**: Crear `components/ui/page-header.tsx`:
```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="-mx-4 -mt-4 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4">
      <div>
        <h2 className="font-headline text-headline-lg text-m3-primary">{title}</h2>
        {description && <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">{description}</p>}
      </div>
      <span className="ml-auto" />
      {actions}
    </div>
  );
}
```

### 4. Login sin loading feedback (Nielsen #1, Severity: alta)
**Dónde**: `login-form.tsx:58-64`
**Qué**: El botón dice "Iniciando sesión..." pero no hay spinner. El usuario no sabe si está procesando o colgado.
**Por qué es crítico**: Silent failure o delays sin feedback generan re-submissions y frustración.
**Fix**:
```tsx
<button
  type="submit"
  disabled={isPending}
  className="... flex items-center gap-2"
>
  {isPending && (
    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
  )}
  {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
</button>
```

### 5. No hay búsqueda local en Usuarios (Nielsen #6, Severity: media)
**Dónde**: `usuarios/page.tsx:28`
**Qué**: Si hay 50+ usuarios, el admin tiene que scrollear todo. Violación directa de "minimize memory load".
**Por qué importa**: Este es un caso de uso real — espacios con muchos testers.
**Fix**: Agregar `<input>` de búsqueda filtrando `initialUsuarios` client-side con `useState` + `useMemo`.

---

## Issues descartados (con justificación)

| Issue | Razón de descarte |
|-------|-------------------|
| "No hay documentación accessible desde la UI" | El sistema tiene documentación en `CLAUDE.md` y docs externos. No es crítico para un dashboard de testers. Nielsen #10 no aplica como issue primario |
| "No hay keyboard shortcuts" | La audiencia son testers que usan el mouse. shortcuts son para power users — no aplica en este contexto |
| "El tema oscuro no tiene toggle" | El M3 design system ya maneja `prefers-color-scheme`. Un toggle manual sería override del sistema, no un missing feature |
| "No hay dark mode consistente en todas las páginas" | M3 tokens ya son dark-mode aware. No hay evidencia de inconsistencia en el code review |
| "Los iconos de la sidebar no tienen tooltips en desktop" | El tooltip `title={item.label}` ya existe en `sidebar-nav.tsx:44` — es accesible en hover, pero solo en desktop rail (no tablet) |

---

## Patrones sistemáticos detectados

### 1. Sin `<PageHeader>` primitivo
**5 páginas redefinen headers a mano** con variaciones del patrón:
```tsx
<div className="-mx-4 -mt-4 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 ...">
```
Archivos: `usuarios/page.tsx:19`, `credenciales/page.tsx:40`, `casos/casos-client.tsx:85`, `espacios/page.tsx:46-53`, `casos/grabar/page.tsx:79`

### 2. SVG icons hand-rolled
**7+ archivos** usan SVGs inline en lugar de Phosphor icons (que es la convención para `material-symbols-outlined` en el resto):
- `espacios-client.tsx:94-116` (edit/delete/people SVGs)
- `user-menu.tsx` (ningún icono de material-symbols)
- `mobile-menu-button.tsx` (usa `menu` symbol — OK)
- `global-search.tsx` (usa `search` symbol — OK)
- `espacio-switcher.tsx:47-60` (SVG chevron en lugar de `expand_more`)

### 3. Sin loading skeletons
**Ninguna página** tiene skeleton loaders. El contenido aparece instantáneamente o no hay feedback durante fetches. Solo el login tiene `isPending` state pero sin spinner.

### 4. Inter como única fuente
`globals.css:1` importa `Inter` + `Fira Code`. No hay Geist/Outfit/Satoshi como especifica design-taste-frontend Section 4.1.

### 5. Transiciones sin duration
Múltiples `transition-opacity hover:opacity-90` sin `duration-*` explícito — la transición es default del navegador (150-200ms) sin curva de easing personalizada.

---

## Screenshot baseline (modo code-based)

No se levantó dev server. La evidencia es markup + código JSX. Ver referencias de archivos en cada issue.

---

## Implicaciones para Paso 3 (Taste Brief) y Paso 4 (Impeccable Directions)

### Issues que debe resolver Impeccable:
1. **Jerarquía visual**: Ninguna página tiene una jerarquía visual clara. Los headers de página deben ser consistentes, los CTAs deben destacar, los stat cards deben tener peso diferenciado.
2. **Micro-interacciones**: El hover de cards es pasivo. Falta `translateY(-2px) scale(1.01)` en hover de todas las cards interactivas.
3. **Transiciones**: Todas las `transition-*` deben usar `duration-[300] ease-[cubic-bezier(0.32,0.72,0,1)]` (Spring Physics) en lugar de默认值.

### Constraints que Impeccable debe respetar:
1. **No romper M3 tokens**: El proyecto usa un sistema M3 bespoke en `globals.css`. Todas las decisiones de color deben usar tokens existentes (`m3-primary`, `m3-surface-container-lowest`, etc.)
2. **Mantener Material Symbols Outlined**: Los iconos del sidebar y UI usan `material-symbols-outlined`. Impeccable no debe reemplazar estos con SVGs hand-rolled
3. **No agregar dependencias nuevas** sin justificación: El proyecto ya tiene `@dnd-kit`, `lucide-react`, `monaco-editor`. No agregar Radix/Phosphor sin necesidad
4. **Preservar dark-mode**: El sistema es dark-first (sidebar navy). Cualquier cambio debe funcionar en ambos modos
5. **Accesibilidad primero**: Focus rings ya están definidos en `globals.css:39-42`. Impeccable no debe remover `focus-visible` rings

### Recomendación de dial settings para redesign:
- `DESIGN_VARIANCE: 5` — La UI actual es conservadora, no romper la estructura
- `MOTION_INTENSITY: 4` — Spring physics en hover y transiciones, no animaciones complejas
- `VISUAL_DENSITY: 6` — Dashboard denso pero legible, no cockpit

---

## Annex: Heuristic Scorecard detallado

| Heurística | Score /10 | Issues |
|------------|-----------|--------|
| Nielsen #1 Visibility | 4 | #4, #8, #12, #15, #24 |
| Nielsen #2 Match real world | 6 | #13, #22 |
| Nielsen #3 User control | 5 | #16, #23, #28 |
| Nielsen #4 Consistency | 3 | #3, #14, #22, #26 |
| Nielsen #5 Error prevention | 4 | #2, #7, #18, #19, #28 |
| Nielsen #6 Recognition | 5 | #6, #10, #19 |
| Nielsen #7 Flexibility | 6 | #11 |
| Nielsen #8 Aesthetic | 4 | #5, #17, #20, #21, #27 |
| Nielsen #9 Error recovery | 3 | #1, #9 |
| Nielsen #10 Help/docs | 8 | (minor) |
| Krug #1 Don't make me think | 4 | #6, #24, #25, #26 |
| Krug #2 Scannability | 5 | #15, #17 |
| Krug #3 Focus | 7 | #10 |
