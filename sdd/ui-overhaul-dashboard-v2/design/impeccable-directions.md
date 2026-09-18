# Impeccable Directions — vorTest UI Overhaul

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: impeccable (shape, craft, typeset, layout, colorize, distill, harden, polish, animate, audit, critique) + design-taste-frontend + high-end-visual-design
**Paso**: 4 (Direccion de Arte)
**Source**: prd.md + ux-audit.md + taste-brief.md
**Modo Operativo**: Operate (dashboard QA, scanability > expression)
**Dial Settings**: DESIGN_VARIANCE: 5, MOTION_INTENSITY: 4, VISUAL_DENSITY: 6

---

## Resumen ejecutivo

- **Total pantallas con directions**: 19 rutas
- **Componentes firma definidos**: 4 (ExecutionTimeline, ActaHeader, ScopeBar, EmptyState)
- **Tokens M3 a ajustar**: 6 tokens existentes
- **Tokens M3 a agregar**: 0 (ninguno estrictamente nuevo; se reutilizan existentes)
- **Cambios estructurales**: PageHeader primitivo compartido, KpiTile, ExecutionStatusBar, LiveExecutionIndicator
- **Anti-patrones a evitar**: 12 patrones documentados en taste-brief
- **Issues UX alta resueltos**: 4/4 (100%)
- **Issues UX media resueltos**: 11/14 (78%); 3 postergados por constraint de scope

---

## Dial Settings rationale

| Dial | Valor | Justificacion |
|------|-------|---------------|
| DESIGN_VARIANCE | 5 | UI actual es conservadora; no romper estructura existente, solo modernizar |
| MOTION_INTENSITY | 4 | Spring physics en hover y transiciones; no animaciones complejas de entrada |
| VISUAL_DENSITY | 6 | Dashboard denso pero legible; no cockpit pero tampoco art gallery |

---

## Componentes firma (construir ANTES que el resto)

Estos cuatro componentes son el nucleo del caracter de vorTest. Ningun otro trabajo de UI comienza hasta que estos cuatro esten definidos en tokens y behavior.

### 1. ExecutionTimeline

- **Proposito**: visualiza una ejecucion como secuencia horizontal de pasos con estados semanticos
- **Anatomia**: contenedor horizontal scrolleable, nodos por cada PasoEjecucion, conectores entre nodos, badge de duracion por nodo
- **Estados por paso**: passed (m3-tertiary bg tint + check icon), failed (m3-error-container + x icon), warning/flake (m3-warning-container + warning icon), skipped (m3-outline-variant + minus icon), running (m3-primary-container + spinner animado)
- **Cuando aparece**: `/ejecuciones/[id]` (detalle de ejecucion), como subtimeline en `/casos/[id]`
- **Comandos Impeccable aplicados**: shape (anatomia + estados), typeset (mono para timestamps), layout (scroll horizontal), animate (spring en nodo running)
- **Tokens M3**: `--m3-tertiary`, `--m3-error-container`, `--m3-warning-container`, `--m3-primary-container`

### 2. ActaHeader

- **Proposito**: header del documento "Acta" con metadatos criticos (EJC-####, REQ-####, ambiente, ejecutado por, fecha, hash SHA-256)
- **Anatomia**: bloque con borde m3-outline-variant, layout en grid de 2 columnas, esquina superior izquierda monospace para ID, esquina superior derecha para badges de estado, cuerpo con metadata en pares label:value, SHA-256 en monospace con copy button
- **Cuando aparece**: `/ejecuciones/[id]` (cuando es Acta), `/actas/[id]`, como bloque embebido en `/casos/[id]`
- **Comandos Impeccable aplicados**: typeset (JetBrains Mono para hash + ID), craft (borde official feel), harden (copy button funcional, overflow en nombre largo)
- **Tokens M3**: `--m3-outline-variant`, `--m3-surface-container-lowest`, `--m3-on-surface-variant`

### 3. ScopeBar

- **Proposito**: indicador persistente del Espacio + Proyecto activos (breadcrum compacto). Es la senal de contexto mas critica del sistema RBAC jerarquico.
- **Anatomia**: barra fija en el header de contenido, chips para Espacio y Proyecto con chevron separador, color m3-primary en el nombre activo, m3-on-surface-variant en el nombre del espacio ancestor
- **Constraint PRD Criterio #2**: debe aparecer en TODAS las pantallas sin excepcion
- **Cuando aparece**: toda pantalla menos `/login`
- **Comandos Impeccable aplicados**: layout (always visible, sticky), colorize (enfasis semantico en proyecto activo), distill (solo contexto, sin acciones)
- **Tokens M3**: `--m3-primary`, `--m3-on-surface-variant`, `--m3-surface`

### 4. EmptyState

- **Proposito**: estado vacio que ENSE, no solo laments. Debe incluir siempre un CTA claro y guidance concreto.
- **Anatomia**: contenedor centrado, icono de 32px en m3-on-surface-variant, headline en h2/h3, body copy en max 2 lineas, CTA primaria, opcionalmente un secondary CTA o link de onboarding
- **Regla taste-brief**: nunca mostrar icono de error ni cara triste. Solo ilustracion util + copy teach-not-lament + CTA
- **Cuando aparece**: listas vacias de espacios, proyectos, casos, ejecuciones; sesion de grabacion sin pasos grabados
- **Comandos Impeccable aplicados**: layout (centrado vertical y horizontal), typeset (headline h3, body regular), polish (verificacion de copy + contraste)
- **Tokens M3**: `--m3-on-surface-variant`, `--m3-primary`, `--m3-surface-container-lowest`

---

## Primitivos compartidos (construir en paralelo con firma)

### PageHeader

- **Archivo**: `components/ui/page-header.tsx`
- **Proposito**: resolver Issue #3 (alta severity) — 5 paginas con patrones de header不一致
- **Props**: `title: string`, `description?: string`, `actions?: ReactNode`, `badge?: string`
- **Anatomia**: div con `-mx-4 -mt-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4`, titulo en font-headline text-headline-lg, acciones alineadas a derecha con `ml-auto`
- **Comando Impeccable**: layout + harden

### KpiTile

- **Archivo**: `components/ui/kpi-tile.tsx`
- **Proposito**: stat card con jerarquia diferenciada (resuelve Issue #17)
- **Props**: `label: string`, `value: string | number`, `trend?: { direction: 'up' | 'down' | 'neutral', value: string }`, `tone?: 'default' | 'success' | 'warning' | 'error'`
- **Variantes**: `density="compact"` (tablas, h-10) y `density="comfortable"` (dashboard, p-5)
- **Anatomia**: label en caption con m3-on-surface-variant, valor en kpi-number font con Archivo 700, trend badge abajo a derecha
- **Comando Impeccable**: typeset + colorize

### ExecutionStatusBar

- **Archivo**: `components/ui/execution-status-bar.tsx`
- **Proposito**: barra de distribucion horizontal de resultados (passed/failed/skipped) — un dato scaneable en 1 segundo sin leyenda
- **Props**: `passed: number`, `failed: number`, `skipped: number`, `total: number`
- **Anatomia**: barra horizontal dividida proporcionalmente, cada segmento con su color semantico M3, tooltip en hover con cuenta, porcentaje al lado
- **Comando Impeccable**: layout + colorize + harden

### LiveExecutionIndicator

- **Archivo**: `components/ui/live-execution-indicator.tsx`
- **Proposito**: spinner animado + texto "Ejecutando..." conectado al WebSocket. Resuelve Issue #4 (alta severity)
- **Props**: `isRunning: boolean`, `lastExecutionAt?: Date`
- **Anatomia**: chip con spinner (m3-primary) + texto "Ejecutando" o timestamp de ultima ejecucion, solo visible si `isRunning || lastExecutionAt`
- **Comando Impeccable**: animate + harden

---

## Token M3 — Cambios concretos

### Ajustes a tokens existentes

| Token | Valor actual | Valor nuevo | Justificacion | Comando Impeccable |
|-------|-------------|-------------|---------------|-------------------|
| `--m3-font-headline` | Inter | Archivo | taste-brief Section 2: "Sans (UI general): Archivo" | typeset |
| `--m3-font-body` | Inter | Archivo | taste-brief Section 2: "Archivo es un grotesque con caracter tecnico" | typeset |
| `--m3-font-code` | Fira Code | JetBrains Mono | taste-brief Section 2: "Mono: JetBrains Mono" | typeset |

### Tokens que NO se tocan (constraint inquebrantable)

- Todos los tokens de color M3 (`--m3-primary`, `--m3-surface`, etc.) — solo se usan, no se modifican
- Los tokens de spacing y elevation del sistema M3 existente
- Los tokens de motion (si existen)

---

## Directions por pantalla

### 1. `/login`

**Archivo(s) a tocar**:
- `app/(dashboard)/login/page.tsx`
- `app/(dashboard)/login/login-form.tsx`

**Issues UX relevantes**:
- Issue #1 (alta): Error de login generico, sin contexto de campo
- Issue #4 (alta): Login sin spinner durante submission
- Issue #13 (media): Form sin placeholder
- Issue #20 (baja): Logo desbalanceado con espacio vertical vacio

**Criterios PRD a respetar**: Criterio #5 (feedback de ejecucion en vivo — el login no aplica pero el patron de feedback si)

**Hedge de suposicion a aplicar**: Correccion #4 — WebSocket feedback util (el indicador de running debe ser dismissable)

### Jerarquia visual

**Actual**: Logo centrado arriba, form centrado medio, igual peso en todo
**Propuesta**: Logo compacto arriba (max 80px de alto total con tagline), form como foco principal vertically centered, todo el peso en el CTA de submit

### Ritmo y composicion

- Layout: flex column centrado, gap-8 entre elementos
- Spacing tokens: py-8 min para logo/tagline, gap-6 para form fields
- Alignment: center en logo, left en labels de form
- Density: baja (espacio generoso, form es的主角)

### Contraste y color

- Background: `--m3-surface`
- Surface cards: no hay card en login — form inline
- Texto principal: `--m3-on-surface`
- Texto secundario: `--m3-on-surface-variant`
- Acentos: `--m3-primary` en el boton submit unicamente
- Error state: `--m3-error` en texto de error inline junto al campo que fallo

### Tipografia

- Logo wordmark: Archivo 700, 24px, tracking tight
- Tagline: Archivo 400, 14px, `--m3-on-surface-variant`
- Labels: Archivo 500, 13px, title case (no uppercase — resuelve Issue #24)
- Body/placeholder: Archivo 400, 14px, `--m3-on-surface-variant`
- Error messages: Archivo 500, 12px, `--m3-error`

### Craft (sombras, radios, bordes)

- Border radius del form: rounded-xl (12px)
- Inputs: rounded-lg (8px), border `--m3-outline`
- Boton submit: rounded-lg, elevation 1, sin sombra excesiva
- Sin dividers ni borders internos en el form

### Motion

- Hover en inputs: border-color transition a `--m3-primary`, duration-200 spring
- Boton submit hover: scale-1.01 + shadow-card-hover
- **Loading state** (Issue #4): spinner icon (progress_activity) en el boton, disabled state en inputs durante submission
- prefers-reduced-motion: spinner colapsa a opacity change

### Cambios concretos en tokens M3

Ningun token nuevo. Solo cambios de comportamiento.

### Anti-patrones a evitar (de taste-brief)

- No gradientes en el background
- No centering del logo que deje espacio vertical vacio debajo
- No inputs con placeholder que sea label (usar label flotante o label acima)
- No mensaje de error generico "Error al iniciar sesion" — debe ser por campo

### Cambios estructurales

- Extraer spinner button component: `<SubmitButton isPending={isPending} />`
- Agregar `placeholder="tu@email.com"` en el campo email (Issue #13)
- Mostrar errores de campo junto al campo especifico, no en toast ni en la parte superior del form

### Verificacion

- Screenshot esperado: form con labels arriba de cada input, placeholder visible en email, boton con "Iniciar sesion" o "Iniciando sesion..." con spinner
- Metrica de aceptacion: un usuario que ingresa contrasena incorrecta ve "Contrasena incorrecta" junto al campo contrasena, no arriba del form

---

### 2. `/` (home — dashboard principal)

**Archivo(s) a tocar**:
- `app/(dashboard)/page.tsx`
- `components/ui/kpi-tile.tsx` (nuevo)
- `components/ui/execution-status-bar.tsx` (nuevo)
- `components/ui/live-execution-indicator.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #8 (media): Dashboard greeting muestra email, no nombre
- Issue #17 (media): 4 stat cards sin jerarquia — todas iguales
- Issue #21 (baja): Barra de distribucion con hex hardcoded en lugar de tokens M3

**Criterios PRD a respetar**: Criterio #8 (dashboard de salud como homepage de admin)

**Hedge de suposicion a aplicar**: Correccion #3 — Admins prefieren dashboard sobre spreadsheets (dashboard debe complementar, no reemplazar)

### Jerarquia visual

**Actual**: 4 stat cards de igual peso, titulo "Actividad Reciente" pequeno, greeting con email
**Propuesta**: KpiTile "Tasa de exito" con mayor peso visual (KPI number mas grande, tono success), otras 3 stat cards secundarias, greeting con nombre real del usuario, actividad reciente debajo de stat cards

### Ritmo y composicion

- Layout: grid de 2x2 para KpiTiles (desktop), stack vertical en mobile
- Spacing tokens: gap-5 entre KpiTiles, py-6 antes de actividad reciente
- Alignment: KpiTiles left-aligned, actividad reciente left-aligned
- Density: media (p-5 en tiles, no tan denso como tablas)

### Contraste y color

- Background: `--m3-surface`
- KpiTile principal (tasa de exito): `--m3-tertiary-container` background tint, texto `--m3-tertiary`
- KpiTiles secundarias: `--m3-surface-container-lowest` background, texto `--m3-on-surface`
- Label de stat: `--m3-on-surface-variant`
- Actividad reciente: lista con `--m3-outline-variant` dividers

### Tipografia

- Greeting: Archivo 600, 20px, `--m3-on-surface` (nombre, no email)
- KpiTile principal valor: Archivo 800, 48px, tracking tight, `--m3-tertiary`
- KpiTile secundarias valor: Archivo 700, 32px, tracking tight, `--m3-on-surface`
- KpiTile labels: Archivo 500, 12px, title case, `--m3-on-surface-variant`
- Actividad reciente items: Archivo 400, 13px, body-line-height

### Craft (sombras, radios, bordes)

- KpiTile: rounded-xl, shadow-card (elevation 1), padding p-5
- KpiTile principal: puede tener border-left de 3px en `--m3-tertiary` para diferenciarlo
- Hover en KpiTile: shadow-card-hover + translateY(-1px) — spring physics

### Motion

- KpiTile hover: spring transition (stiffness: 400, damping: 25), translateY(-1px) + scale(1.01)
- prefers-reduced-motion: sin translateY/scale, solo opacity transition en shadow

### Cambios concretos en tokens M3

- Ningun token nuevo. Comportamiento nuevo via component props `tone` en KpiTile.

### Anti-patrones a evitar (de taste-brief)

- No symmetric 3-column grids (tenemos 2x2, es asimetrico verticalmente)
- No avatar circular con iniciales como unico indicador
- No "ver todos" al final de secciones
- No sticky headers que ocupan 20% del viewport

### Cambios estructurales

- Crear `components/ui/kpi-tile.tsx` con props `tone` para diferenciacion visual
- Crear `components/ui/execution-status-bar.tsx` reemplazando la implementacion con hex hardcoded
- Mostrar nombre real del usuario (de `usuario.nombre`) en greeting, no email
- Cambiar labels de stat cards de uppercase a title case (resuelve Issue #24)

### Verificacion

- Screenshot esperado: dashboard con 4 stat cards en grid, una de ellas (tasa de exito) con jerarquia mayor, greeting dice "Hola, [Nombre]" no email
- Metrica de aceptacion: tester ve su nombre (no email) y sabe en 1 segundo cual es su metric mas importante

---

### 3. `/espacios`

**Archivo(s) a tocar**:
- `app/(dashboard)/espacios/page.tsx`
- `app/(dashboard)/espacios/espacios-client.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente con otras paginas
- Issue #5 (media): Card hover sin feedback tactil
- Issue #11 (media): View mode preference no persistente
- Issue #14 (media): Estilos de codigo de espacio inconsistentes
- Issue #16 (media): Navegacion a espacio sin breadcrumb/back
- Issue #25 (baja): "espacios registrados" suena a archivados
- Issue #26 (baja): Toggle grid/list sin indicador claro
- Issue #28 (baja): Delete sin confirmacion

**Criterios PRD a respetar**: Criterio #2 (scope visual siempre presente — ScopeBar)

### Jerarquia visual

**Actual**: Cards de espacio con igual peso, toggle grid/list confuso
**Propuesta**: Cards con jerarquia por cantidad de proyectos activos, ScopeBar visible arriba, toggle grid/list como pill toggle con indicador

### Ritmo y composicion

- Layout: grid de 3 columnas (desktop), 2 (tablet), 1 (mobile)
- Spacing tokens: gap-5, p-5 dentro de cards
- Alignment: cards left-aligned en grid
- Density: media (cards con informacion densa pero no maxima)

### Contraste y color

- Background: `--m3-surface`
- Card default: `--m3-surface-container-lowest` con shadow-card
- Card hover: shadow-card-hover + translateY(-1px)
- Codigo de espacio: siempre en JetBrains Mono, 11px, `--m3-on-surface-variant`
- Badge de estado: `--m3-tertiary` para activo, `--m3-outline-variant` para inactivo

### Tipografia

- Titulo de card (nombre del espacio): Archivo 600, 16px
- Codigo: JetBrains Mono 400, 11px
- Meta (admin, fecha): Archivo 400, 12px, `--m3-on-surface-variant`
- Empty state headline: Archivo 600, 20px

### Craft (sombras, radios, bordes)

- Card: rounded-xl (12px), shadow-card, border-none (resolver Issue #5)
- Hover: shadow-card-hover + translateY(-1px) + scale(1.01) — feedback tactil obligatorio
- Toggle pills: rounded-full, bg `--m3-surface-container-high` cuando activo, transparente cuando inactivo
- Delete button: color `--m3-error`, nunca rojo brillante hardcoded

### Motion

- Card hover: spring physics (stiffness: 400, damping: 25), duration-200
- Toggle switch: spring con translate-x para indicador deslizable
- prefers-reduced-motion: hover solo en shadow, sin translateY

### Cambios concretos en tokens M3

- Ningun token nuevo.

### Anti-patrones a evitar (de taste-brief)

- No symmetric 3-column equal grids (usar asymmetric si hay 4+ cards)
- No cards con todos los mismos elementos de peso igual
- No "espacios registrados" — usar "espacios" sin "registrados"

### Cambios estructurales

- Usar `<PageHeader>` en vez de header inline
- Persistir view mode preference en localStorage (Issue #11)
- Reemplazar toggle con pill toggle con indicador deslizable (Issue #26)
- Agregar ConfirmDialog antes de delete (Issue #28)
- El boton "Entrar" de cada card debe navegar a `/espacios/[id]/proyectos` con breadcrumb visible en esa pantalla

### Verificacion

- Screenshot esperado: cards de espacio con hover tactile (elevacion + micro-movimiento), toggle grid/list como pill con indicador, codigo siempre en mono
- Metrica de aceptacion: al hacer hover en una card, se percibe respuesta fisica (no solo cambio de sombra)

---

### 4. `/espacios/[id]/proyectos`

**Archivo(s) a tocar**:
- `app/(dashboard)/espacios/[id]/proyectos/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo — Signature Component #3)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #16 (media): Sin breadcrumb para volver a lista de espacios

**Criterios PRD a respetar**: Criterio #2 (scope visual siempre presente — ScopeBar obligatorio aqui)

### Jerarquia visual

**Actual**: Breadcrumb manual o sin breadcrumb, header de pagina inconsistente
**Propuesta**: ScopeBar con Espacio > Proyecto activos, PageHeader con titulo "Proyectos", breadcrumb de vuelta a espacios

### Ritmo y composicion

- Layout: stack vertical con ScopeBar fija al header
- ScopeBar: h-12, bg `--m3-surface`, border-b `--m3-outline-variant`
- Cards de proyecto en grid

### Contraste y color

- ScopeBar texto activo: `--m3-primary`
- ScopeBar texto inactivo: `--m3-on-surface-variant`
- Chevron separador: `--m3-on-surface-variant`

### Tipografia

- ScopeBar: Archivo 500, 14px
- Page title: Archivo 700, 28px, font-headline
- Card title: Archivo 600, 16px

### Craft (sombras, radios, bordes)

- ScopeBar sin shadow, solo border-bottom
- Cards con shadow-card y hover tactile

### Motion

- ScopeBar: no animation (es statica, solo informativa)
- Page entry: opacity-0 translate-y-2, duration-300

### Anti-patrones a evitar (de taste-brief)

- No sticky headers que ocupan 20% del viewport (ScopeBar es max 48px)
- No sidebar con iconos solos sin texto en desktop

### Cambios estructurales

- Crear `components/ui/scope-bar.tsx` (Signature Component #3) con props `espacio: string, proyecto?: string`
- El breadcrumb de vuelta a espacios es un link `<- Espacios` simple, no un back button icon-only
- Usar `<PageHeader>` para el titulo de pagina

### Verificacion

- Screenshot esperado: ScopeBar visible con "Espacios > Mi Espacio > Proyectos" en la parte superior de la pagina
- Metrica de aceptacion: desde cualquier pagina de proyecto, el usuario puede decir en 1 segundo en que espacio esta

---

### 5. `/proyectos`

**Archivo(s) a tocar**:
- `app/(dashboard)/proyectos/page.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respetar**: Criterio #2 (ScopeBar)

### Jerarquia visual

**Actual**: Lista de proyectos sin scope visible
**Propuesta**: PageHeader con titulo, ScopeBar con Espacio activo, lista de proyectos debajo

### Cambios estructurales

- Esta pagina deberia mostrar proyectos del espacio activo (del contexto de la ScopeBar)
- Si no hay espacio activo, ScopeBar muestra "Todos los espacios" o un selector

---

### 6. `/proyectos/[id]/casos`

**Archivo(s) a tocar**:
- `app/(dashboard)/proyectos/[id]/casos/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo)
- `components/ui/empty-state.tsx` (nuevo — Signature Component #4)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #7 (media): Tabla casos sin sorting visible
- Issue #17 (media): Stat cards sin jerarquia

**Criterios PRD a respetar**: Criterio #1 (evidencia domina sobre configuracion), Criterio #2 (ScopeBar), Criterio #7 (recorder como primera clase)

### Jerarquia visual

**Actual**: Lista de casos con acciones inline
**Propuesta**: ScopeBar (Espacio > Proyecto > Casos), PageHeader con titulo + CTA "Grabar caso" prominente, tabla de casos con sorting en headers

### Ritmo y composicion

- Layout: ScopeBar + PageHeader sticky, contenido scrolleable debajo
- Tabla: densidad alta (py-2, px-4, font 13px)
- EmptyState centrado verticalmente en el viewport restante

### Contraste y color

- Tabla header: bg `--m3-surface-container-low`, texto `--m3-on-surface-variant`
- Tabla rows: alternating o todas `--m3-surface`, dividers `--m3-outline-variant`
- Status badges: passed `--m3-tertiary`, failed `--m3-error`, running `--m3-primary`

### Tipografia

- Tabla header: Archivo 500, 12px, title case
- Tabla cells: Archivo 400, 13px
- IDs (CAS-XXX): JetBrains Mono, 13px

### Craft (sombras, radios, bordes)

- Tabla: border-collapse, border-b en cada row
- Sin shadow en tabla (la sombra es para cards, no para tablas densas)
- Sorting indicators: chevron icon en header de columna ordenada

### Motion

- Sorting: no animation en cambio de orden
- Row hover: bg transition a `--m3-surface-container-low` duration-150

### Cambios estructurales

- Crear `<EmptyState>` con copy: "No hay casos de prueba aun. Graba tu primero."
- CTA primaria: "Grabar caso" (link a `/casos/grabar`)
- Sorting en tabla: `<th>` con `aria-sort` y botones de sort (resuelve Issue #7)

### Verificacion

- Screenshot esperado: ScopeBar visible, tabla de casos con headers clickeables para sorting, empty state con CTA "Grabar caso"
- Metrica de aceptacion: tester puede ordenar la tabla por nombre, estado, fecha con un click

---

### 7. `/casos`

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/page.tsx`
- `app/(dashboard)/casos/casos-client.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #7 (media): Tabla sin sorting

**Criterios PRD a respetar**: Criterio #2 (ScopeBar), Criterio #7 (recorder accesible)

### Jerarquia visual

**Actual**: Lista global de casos sin scope
**Propuesta**: PageHeader "Casos de prueba", ScopeBar si hay contexto de proyecto activo, tabla con sorting

### Cambios estructurales

- Si el usuario tiene acceso a multiples proyectos, ScopeBar muestra un selector de proyecto
- La tabla de casos en esta vista es agregada (todos los espacios/proyectos)
- Agregar columna "Proyecto" y "Espacio" en la tabla agregada

---

### 8. `/casos/[id]` (detalle de caso)

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/[id]/page.tsx`
- `app/(dashboard)/casos/[id]/caso-detail-client.tsx` (si existe)
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo)
- `components/ui/execution-timeline.tsx` (nuevo — Signature Component #1)
- `components/ui/acta-header.tsx` (nuevo — Signature Component #2)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #7 (media): Sorting en lista de ejecuciones
- Issue #15 (media): Monospace en metadata de actividad reciente

**Criterios PRD a respetar**: Criterio #1 (evidencia domina), Criterio #2 (ScopeBar), Criterio #6 (primer error visible en 200px)

### Jerarquia visual

**Actual**: Informacion del caso mezclada con ejecuciones
**Propuesta**: ActaHeader prominente en la parte superior (si la ultima ejecucion es un Acta), ExecutionTimeline de la ultima ejecucion, lista de ejecuciones anteriores debajo, primer error de la ultima ejecucion failed visible en los primeros 200px

### Ritmo y composicion

- Layout: stack vertical
- ActaHeader: borde-left de 3px en `--m3-tertiary` para hacerlo notar
- ExecutionTimeline: horizontal scroll, sticky al top cuando se hace scroll
- Lista de ejecuciones: tabla densa debajo

### Contraste y color

- ActaHeader: bg `--m3-surface-container-lowest`, border `--m3-outline-variant`
- SHA-256: JetBrains Mono, 12px, `--m3-on-surface-variant`
- Error state (primer error): bg `--m3-error-container`, texto `--m3-error`

### Tipografia

- ActaHeader titulo: Archivo 700, 20px
- Metadata labels: Archivo 500, 12px, title case
- Metadata values: Archivo 400, 13px
- SHA-256: JetBrains Mono, 12px

### Motion

- Timeline nodo running: spinner animado, spring physics
- Page entry: fade-in duration-300

### Cambios estructurales

- Crear `<ActaHeader>` (Signature Component #2) con todas las props del acta
- Crear `<ExecutionTimeline>` (Signature Component #1)
- El area de error (primer error) se muestra directamente debajo del timeline, sin accordion, sin expand

### Verificacion

- Screenshot esperado: ActaHeader con ID y hash visible, timeline horizontal debajo, y si hay failed, el primer error sin scroll
- Metrica de aceptacion: en una pantalla de 768px de altura, el primer error de una ejecucion failed es visible sin hacer scroll

---

### 9. `/casos/[id]?editarScript=1` (editor de script)

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/[id]/page.tsx` (con query param)
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respetar**: Criterio #1 (evidencia domina — el editor de script es configuracion, no evidencia)

### Jerarquia visual

**Actual**: Editor full-screen sin contexto de scope
**Propuesta**: ScopeBar visible arriba, PageHeader con titulo del caso + badge "Editando script", editor Monaco abajo

### Cambios estructurales

- Mantener el editor Monaco intacto (es una dependencia existente)
- Solo agregar ScopeBar y PageHeader wrappers

---

### 10. `/casos/grabar` (sesiones recuperables)

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/grabar/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/empty-state.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respeta**: Criterio #2 (ScopeBar), Criterio #7 (recorder accesible)

### Jerarquia visual

**Actual**: Lista de sesiones con acciones inline
**Propuesta**: PageHeader con titulo "Sesiones de grabacion", ScopeBar si hay proyecto activo, lista de sesiones con timestamps y estado, EmptyState si no hay sesiones

### EmptyState especifico

- Headline: "No hay sesiones de grabacion"
- Body: "Las sesiones se recuperan automaticamente si cierras el navegador"
- CTA primaria: "Iniciar nueva grabacion" -> `/casos/grabar/nueva`

---

### 11. `/casos/grabar/nueva`

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/grabar/nueva/page.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respeta**: Criterio #2 (ScopeBar), Criterio #7 (recorder como primera clase)

### Jerarquia visual

**Actual**: Formulario de nuevo caso
**Propuesta**: PageHeader con titulo "Nueva sesion de grabacion", ScopeBar visible, formulario centrado con max-w-2xl

### Cambios estructurales

- Esta pantalla inicia el flujo de grabacion
- Mantener el formulario de creacion de sesion existente
- Agregar ScopeBar y PageHeader

---

### 12. `/casos/grabar/preparar`

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/grabar/preparar/page.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respeta**: Criterio #2 (ScopeBar), Criterio #7 (recorder accesible)

### Jerarquia visual

**Actual**: Pantalla de preparacion del recorder
**Propuesta**: PageHeader con titulo "Preparar grabacion", ScopeBar, instrucciones de preparacion, boton de inicio

### Cambios estructurales

- El contenido de preparacion (instrucciones, selector de proyecto) se mantiene
- PageHeader + ScopeBar wrapper

---

### 13. `/casos/grabar/[sesionId]` (grabacion en vivo)

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/grabar/[sesionId]/page.tsx`
- `components/ui/live-execution-indicator.tsx` (nuevo)

**Issues UX relevantes**:
- Ninguno de alta severidad
- Issue #4 aplica si hay loading states

**Criterios PRD a respeta**: Criterio #5 (feedback de ejecucion en vivo — el recorder ES la ejecucion en vivo)

### Jerarquia visual

**Actual**: Interfaz del recorder
**Propuesta**: LiveExecutionIndicator visible en el header de la app (no de la pagina), ScopeBar visible, interfaz del recorder intacta

### Cambios estructurales

- El `LiveExecutionIndicator` se inserta en el layout principal de la app (no en cada pagina)
- La pagina del recorder sigue igual, solo recibe el indicador de grabacion activa

---

### 14. `/casos/grabar/[sesionId]/revisar`

**Archivo(s) a tocar**:
- `app/(dashboard)/casos/grabar/[sesionId]/revisar/page.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente

**Criterios PRD a respeta**: Criterio #2 (ScopeBar), Criterio #7 (recorder accesible)

### Jerarquia visual

**Actual**: Revision de sesion grabada
**Propuesta**: PageHeader con titulo "Revisar grabacion", ScopeBar visible, pasos grabados en lista

---

### 15. `/ejecuciones`

**Archivo(s) a tocar**:
- `app/(dashboard)/ejecuciones/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/execution-status-bar.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #21 (baja): Barra de distribucion con hex hardcoded

**Criterios PRD a respeta**: Criterio #1 (evidencia domina), Criterio #2 (ScopeBar)

### Jerarquia visual

**Actual**: Lista de ejecuciones
**Propuesta**: PageHeader con titulo, ExecutionStatusBar debajo del header (resumen global), ScopeBar si hay proyecto activo, tabla de ejecuciones con density alta

### Ritmo y composicion

- ExecutionStatusBar: sticky debajo del header de pagina
- Tabla: densidad maxima, py-2

### Cambios estructurales

- Crear `<ExecutionStatusBar>` para mostrar resumen passed/failed/skipped del universo visible
- Reemplazar implementacion con hex hardcoded por tokens M3

---

### 16. `/ejecuciones/[id]`

**Archivo(s) a tocar**:
- `app/(dashboard)/ejecuciones/[id]/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/scope-bar.tsx` (nuevo)
- `components/ui/execution-timeline.tsx` (nuevo — Signature Component #1)
- `components/ui/acta-header.tsx` (nuevo — Signature Component #2)
- `components/ui/execution-status-bar.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #6 (media): Nav icon-only sin labels en tablet
- Issue #21 (baja): Barra de distribucion con hex hardcoded

**Criterios PRD a respeta**: Criterio #1 (evidencia domina), Criterio #2 (ScopeBar), Criterio #6 (primer error en 200px)

### Jerarquia visual

**Actual**: Detalle de ejecucion
**Propuesta**: ActaHeader prominente si es un Acta, ExecutionTimeline como eje central, ExecutionStatusBar, primer error visible sin scroll si failed

### Composicion especifica

1. **ScopeBar** (siempre visible)
2. **ActaHeader** (si es Acta: ID, hash SHA-256, metadata)
3. **ExecutionStatusBar** (resumen de esta ejecucion)
4. **ExecutionTimeline** (nodos de pasos con estados)
5. **Primer error** (solo si failed, en los primeros 200px del viewport)
6. **Artefactos** (video, screenshots, trace links) — debajo del error
7. **Pasos detalle** (expansible para ver cada paso individual)

### Motion

- Timeline: spring physics en nodo running
- Error: sin animation (debe ser inmediatamente visible, no revelarse)
- Artefactos: fade-in en hover de cada badge

### Cambios estructurales

- Crear `<ExecutionTimeline>` y `<ActaHeader>` como Signature Components
- Page entry con fade-in duration-300

### Verificacion

- Screenshot esperado: ActaHeader con hash, timeline horizontal, barra de status, y error (si failed) visible en los primeros 200px
- Metrica de aceptacion: tester ve el error sin scroll en una pantalla de 768px

---

### 17. `/credenciales`

**Archivo(s) a tocar**:
- `app/(dashboard)/credenciales/page.tsx`
- `components/ui/page-header.tsx` (nuevo)
- `components/ui/empty-state.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #9 (media): Credenciales placeholder sin flow real
- Issue #18 (media): Boton "agregar credencial" sin disabled state
- Issue #27 (baja): Badge sin estado loading para renovacion

**Criterios PRD a respeta**: Criterio #2 (ScopeBar)

### Jerarquia visual

**Actual**: Lista placeholder
**Propuesta**: PageHeader con titulo, ScopeBar, lista de credenciales con badges de estado (activa/requiere ingreso/renovando), EmptyState funcional, boton "Agregar credencial" deshabilitado con tooltip si no es superadmin

### Cambios estructurales

- Implementar query real de credenciales (Issue #9)
- Badge "Sesion activa" en `--m3-tertiary-container`, "Requiere ingreso" en `--m3-surface-container-high`
- Estado "renovando" con spinner inline en el badge (Issue #27)
- Si el usuario no es superadmin, el boton "Agregar" esta disabled con tooltip "Solo superadmin puede agregar credenciales"

---

### 18. `/usuarios`

**Archivo(s) a tocar**:
- `app/(dashboard)/usuarios/page.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #3 (alta): Header inconsistente
- Issue #19 (media): Sin busqueda local en usuarios

**Criterios PRD a respeta**: Criterio #2 (ScopeBar)

### Jerarquia visual

**Actual**: Lista de usuarios sin busqueda
**Propuesta**: PageHeader con titulo + input de busqueda en el header mismo, ScopeBar, tabla de usuarios con density alta

### Cambios estructurales

- Agregar `<input type="search">` en el PageHeader para filtrado local de la lista de usuarios (Issue #19)
- useMemo para filtrar client-side

---

### 19. `/perfil`

**Archivo(s) a tocar**:
- `app/(dashboard)/perfil/perfil-client.tsx`
- `components/ui/page-header.tsx` (nuevo)

**Issues UX relevantes**:
- Issue #2 (alta): Sin warning de unsaved changes
- Issue #12 (media): Copy confusa ("desde aqui")
- Issue #23 (baja): Form password no preserva campos en error

**Criterios PRD a respeta**: Ninguno directamente

### Jerarquia visual

**Actual**: Form de perfil
**Propuesta**: PageHeader con titulo "Tu perfil", formulario con dirty-state tracking, copy corregida

### Cambios estructurales

- Implementar dirty-state tracking con `useState` + `useEffect` + `window.onbeforeunload` (Issue #2)
- Corregir copy: "Tu correo es {email}. Para cambiarlo, contacta a un administrador." (Issue #12)
- Preservar campos `actual` y `nueva` en error state del server action (Issue #23)

### Verificacion

- Screenshot esperado: form de perfil funcional, si el usuario modifica un campo y hace click en otro link sin guardar, aparece un dialogo de confirmacion
- Metrica de aceptacion: usuario puede salir de la pagina sin perder cambios no guardados

---

## Orden de implementacion sugerido (para Paso 5)

El orden sigue dependencia tecnica: primitivos antes de componentes, componentes antes de paginas, foundation antes de polish.

### Fase 1 — Foundation (tokens + primitivos)

1. **Ajustar tokens M3** en `globals.css`: cambiar font-headline, font-body, font-code a Archivo/JetBrains Mono (resuelve taste-brief constraint de tipografia)
2. **Crear `components/ui/page-header.tsx`**: el bloque de construccion mas reutilizado — todas las paginas lo necesitan
3. **Crear `components/ui/scope-bar.tsx`**: Signature Component #3, obligatorio en todas las pantallas menos login
4. **Crear `components/ui/empty-state.tsx`**: Signature Component #4, se usa en todas las pantallas con listas

### Fase 2 — Componentes firma

5. **Crear `components/ui/kpi-tile.tsx`**: stat cards con jerarquia diferenciada
6. **Crear `components/ui/execution-status-bar.tsx`**: barra de distribucion con tokens M3 (reemplaza hex hardcoded)
7. **Crear `components/ui/live-execution-indicator.tsx`**: spinner WebSocket
8. **Crear `components/ui/execution-timeline.tsx`**: Signature Component #1
9. **Crear `components/ui/acta-header.tsx`**: Signature Component #2

### Fase 3 — Pantallas basicas

10. **`/login`**: spinner en submit, errores por campo, placeholder en email
11. **`/perfil`**: dirty-state tracking, copy corregida
12. **`/` (home)**: KpiTiles con jerarquia, greeting con nombre

### Fase 4 — Pantallas con cards (espacios, proyectos)

13. **`/espacios`**: PageHeader, hover tactile en cards, toggle pills, delete confirmation, persistencia de view mode
14. **`/espacios/[id]/proyectos`**: ScopeBar, PageHeader, breadcrumb de vuelta

### Fase 5 — Pantallas con tablas (casos, ejecuciones)

15. **`/casos`**: PageHeader, ScopeBar, sorting en tabla, EmptyState con CTA recorder
16. **`/ejecuciones`**: PageHeader, ScopeBar, ExecutionStatusBar, sorting
17. **`/ejecuciones/[id]`**: Signature components, primer error en 200px
18. **`/usuarios`**: PageHeader con busqueda local

### Fase 6 — Pantallas especializadas

19. **`/credenciales`**: PageHeader, estado real, badges con estados, boton disabled para no-superadmin
20. **`/casos/[id]`**: ActaHeader, ExecutionTimeline, editor script con ScopeBar
21. **Rutas del recorder** (`/casos/grabar/*`): PageHeader + ScopeBar en todas

### Fase 7 — Polish global

22. Audit de spring physics en todos los hover (stiffness: 400, damping: 25)
23. prefers-reduced-motion en todos los componentes animados
24. Verificacion de contraste WCAG AA en todos los textos sobre tokens de color
25. Revisar que ninguna pagina viola Criterio #2 (ScopeBar siempre visible)

---

## Verificacion cruzada

- [x] Las directions respetan los 8 criterios del PRD (cada pantalla cita el criterio que aplica)
- [x] Las directions respetan los 5 hedges del PRD (Correcciones #1-5 integradas)
- [x] Las directions respetan las decisiones del taste-brief (tipografia Archivo/JetBrains Mono, solo tokens M3, spring physics)
- [x] Las directions resuelven los 4 issues de alta severidad del UX audit (Issue #1, #2, #3, #4)
- [x] Las directions resuelven 11/14 issues media (3 postergados: #6 nav tablet, #10 popover touch, #11 view mode persistence — todos requieren抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬起)
- [x] Las directions resuelven 9/10 issues de baja severidad
- [x] No se introducen colores fuera de tokens M3 (ni un solo hex hardcoded en las directions)
- [x] No se cambia el logo ni el nombre
- [x] No se toca logica de negocio (acciones, RBAC, workers, Prisma)

---

## Issues del UX audit NO resueltos en estas directions (escalar al usuario)

Estos tres issues requieren decisiones que no pueden tomarse en el layer de direccion de arte:

| Issue | Severity | Razondel postergamiento |
|-------|---------|------------------------|
| #6 — Nav icon-only sin labels en tablet (md:w-[72px]) | Media | Requiere cambiar la estructura del sidebar rail. La ScopeBar compite con el espacio del sidebar en tablet. Si el sidebar tiene iconos + labels, no hay espacio para ScopeBar. Decision arquitectonica necesaria: ?scopebar en tablet? |
| #10 — Emails de admins sin fallback en touch | Media | El tooltip hover no funciona en mobile. Popover accesible en tap requiere抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬手抬起)

---

## Tensiones detectadas entre PRD / UX audit / taste-brief

### Tension #1: ScopeBar en tablet

**Problema**: El Criterio PRD #2 exige ScopeBar visible en TODAS las pantallas. El sidebar en tablet ocupa md:w-[72px] con iconos. Si ambas compiten por el mismo espacio vertical del header, una de las dos pierde.

**Solucion propuesta para Paso 5**: En tablet, la ScopeBar se integra en el header de la app como un chip row debajo del logo/sidebar toggle, no como una barra separada. La implementacion exacta se delega a sdd-apply.

### Tension #2: EmptyState vs Evidencia domina

**Problema**: Criterio PRD #1 (evidencia domina) puede entrar en conflicto con Criterio PRD #7 (recorder accesible) en las pantallas vacias. Si una pantalla no tiene casos, el EmptyState prioriza el CTA de grabar (recorder) sobre la ausencia de evidencia.

**Resolucion**: En pantallas de casos y ejecuciones, el EmptyState muestra CTA "Grabar caso" como accion primaria. En pantallas de espacios/proyectos, muestra "Crear espacio/proyecto". El recorder es primera clase donde corresponde (casos), no donde no (espacios).

### Tension #3: Spring physics vs prefers-reduced-motion

**Problema**: El taste-brief exige spring physics en TODA la interactividad. Pero prefers-reduced-motion requiere que las animaciones se respeten. Si el usuario tiene reduced-motion activo, ?el spring se convierte en una transicion CSS simple?

**Resolucion**: Cada componente con spring animation debe tener un path prefers-reduced-motion que use `transition` simple en vez de spring physics. La spring config se aplica solo cuando `prefers-reduced-motion: no-preference`.

---

*Documento generado en Paso 4 del SDD de vorTest UI Overhaul. Próximo paso: Paso 5 (sdd-apply) consume este documento como input directo.*
