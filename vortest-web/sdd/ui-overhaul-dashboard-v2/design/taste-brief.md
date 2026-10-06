# Taste Brief — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: design-taste-frontend + high-end-visual-design + brandkit + minimalist-ui + industrial-brutalist-ui
**Paso**: 3 (Taste)

---

## Personalidad visual del producto

vorTest es un dashboard preciso y tecnico para equipos de QA que necesitan evidencia de testing que nadie pueda cuestionar. La UI debe sentirse como una sala de control de mision — donde cada pixel comunica estado, cada color tiene significado, y la informacion densa es scaneable en segundos, no minutos.

El caracter de vorTest es instrumento de precision — no es una herramienta generica de gestion de proyectos. El tester debe sentir que esta operando un sistema de medicion y registro profesional, no un SaaS de consumo. Esto significa: estructura visible, tipografia tecnica dominante, jerarquia cromatica estrictamente semantica, y cero decoracion sin proposito. La evidencia (video, trace, screenshots) es la protagonista; la UI es el marco que la presenta sin interferir.

vorTest no tiene partners ni stakeholders visibles en su interfaz — es una herramienta de trabajo interno de equipos de QA. Por eso el tono es sobrrio, funcional y autoritativo. No intenta ser amigable — intenta ser exacto.

---

## Lo que NO es

- No es un SaaS de gestion de tareas (Jira, Linear, Asana) — vorTest no tiene kanban, no tiene comments, no tiene asignados. Su unidad es el Acta de testing, no el ticket.
- No es una plataforma de CI/CD (Jenkins, GitHub Actions) — no hay configuracion de builds ni pipelines visibles. La ejecucion es un evento discrete con evidencia discrete.
- No es un CMS de marketing — cero gradientes, cero illustrations hero, cero copy generico. El contenido ES la evidencia; la UI solo la presenta.
- No es una app de consumo — no hay onboarding de 5 pantallas, no hay empty states con ilustraciones tiernas, no hay gamificacion.
- No es ReportPortal generico — aunque comparte categoria, vorTest debe diferenciarse por la prominencia del Acta PDF y por la jerarquia visual que prioriza evidencia sobre navegacion.
- No es una terminal — aunque usa tipografia tecnica y monospace, la UI es accesible para testers no tecnicos. El monospace NO domina sobre el sans-serif.
- No es dark mode — por constraint del usuario, todo es light substrate. El tactical telemetry se manifiesta en estructura y densidad, no en colores oscuros.
- No es responsive-first consumer app — es desktop-first con tablet rail (md:w-72px). Mobile es drawer, no diseño primario.

---

## Decisiones de tipografia

### Familia principal

- **Sans (UI general, body, labels, navegacion)**: Archivo, weight 400/500/600. Archivo es un grotesque con caracter tecnico — angular pero no frio. Uso: titulos de seccion (h2, h3), labels de tabla, badges, navegacion.
- **Mono (codigo, datos tecnicos, metadatos)**: JetBrains Mono, weight 400/500. Uso: SHA-256 hashes, timestamps ISO, stack traces, IDs de caso (#CAS-{id}), rutas de archivo en metadata. **No usar para textos de navegacion ni labels de seccion.**
- **Display (headlines, KPIs grandes)**: Archivo, weight 700/800, con tracking tight (-0.02em a -0.03em). Uso: numeros grandes en stat cards, titulos de pagina.

### Escala tipografica

| Rol | Font | Size | Weight | Line-height | Letter-spacing | Uso |
|-----|------|------|--------|-------------|---------------|-----|
| h1 / Page title | Archivo | 28px / 1.75rem | 700 | 1.2 | -0.02em | Titulos de pagina |
| h2 / Section title | Archivo | 20px / 1.25rem | 600 | 1.3 | -0.01em | Secciones dentro de pagina |
| h3 / Card title | Archivo | 16px / 1rem | 600 | 1.4 | 0 | Titulos de card, filas de tabla |
| Body / UI text | Archivo | 14px / 0.875rem | 400 | 1.5 | 0 | Texto general, labels |
| Caption / Meta | Archivo | 12px / 0.75rem | 400 | 1.4 | 0 | Metadatos, timestamps |
| Label / Badge | Archivo | 11px / 0.6875rem | 500 | 1.2 | 0.04em | Badges de status, tags |
| Mono / Code | JetBrains Mono | 13px / 0.8125rem | 400 | 1.5 | 0 | SHA-256, IDs, stack traces |
| KPI number | Archivo | 48px / 3rem | 800 | 1 | -0.03em | Numeros grandes en stat cards |

### Reglas de uso

- **Sans vs Mono**: mono se usa SOLO para datos que el usuario necesita interpretar como codigo o copiar. El resto de la UI es sans.
- **Bold**: se usa solo para enfasis dentro de un mismo nivel jerarquico.
- **Italic**: NO usar italic en ningun lugar de la UI.
- **Truncation**: texto que no entra se trunca con ellipsis en una sola linea, nunca wrap. El tooltip muestra el texto completo en hover.
- **Labels en minusculas**: las labels de stat cards usan title case (Proyectos, no PROYECTOS). Las badges usan sentence case (En ejecucion, no EN EJECUCION).

---

## Decisiones de color

### Paleta semantica (tokens M3)

vorTest usa tokens M3 existentes. No se crean colores nuevos fuera de la paleta M3.

| Rol semantico | Token M3 | Uso |
|---------------|----------|-----|
| Primary | m3-primary | Botones primarios, links, acciones de CTA |
| On-primary | m3-on-primary | Texto sobre botones primarios |
| Secondary | m3-secondary | Acciones secundarias, iconos de navegacion activa |
| Surface / Background | m3-surface | Fondo de pagina |
| Surface container | m3-surface-container | Cards, paneles, drawers |
| Surface container lowest | m3-surface-container-lowest | Fondo de cards elevado |
| On-surface | m3-on-surface | Texto principal |
| On-surface-variant | m3-on-surface-variant | Texto secundario, labels |
| Outline | m3-outline | Bordes de inputs, dividers |
| Outline variant | m3-outline-variant | Bordes sutiles, lineas de tabla |
| Error | m3-error | Status failed, errores |
| Error container | m3-error-container | Background de errores en cards |
| Success (tertiary) | m3-tertiary | Status passed, badges positivos |
| Warning | m3-warning-container | Status flaky, advertencias |

**Tradeoff**: M3 no tiene token semantico success nativo. Se usa m3-tertiary para passed porque es el color que mejor funciona sobre fondo claro.

### Uso del color

- **Color saturado**: reservado exclusivamente para status semantico (passed/failed/running), CTAs primarios, y badges de estado.
- **Neutral**: el 90% de la superficie visible es neutros M3. El color existe para comunicar estado.
- **Como indicar estado**:
  - Passed: m3-tertiary background tint + texto m3-tertiary
  - Failed: m3-error-container background + m3-error texto + m3-error icono
  - Running: m3-primary-container background + spinner animado
  - Flaky: m3-warning-container background + m3-warning texto
  - Skipped: m3-outline-variant background + m3-on-surface-variant texto

### Lo que NO hacer con color

- No gradientes — ni linear-gradient ni radial-gradient.
- No colores fuera de tokens M3.
- No accent color para texto de parrafo — m3-primary solo aparece en CTAs, links, y badges de estado.
- No dark mode — por constraint del usuario.
- No hardcoded hex — todos los colores son tokens M3.

---

## Decisiones de densidad

### Densidad alta (tablas, listas de ejecucion)

- **Padding de fila**: py-2 (8px) vertical, px-4 (16px) horizontal
- **Font size**: 13px / 0.8125rem
- **Row height**: 40px minimo para touch targets, 36px para filas de datos puros
- **Icon size**: 16px en celdas de tabla
- **Overflow**: scroll horizontal en tablas angostas; nunca wrap de contenido en celdas

### Densidad media (cards, KPIs, listas cortas)

- **Padding**: p-5 (20px)
- **Font size**: body standard 14px
- **Border radius**: rounded-xl (12px) maximo; rounded-lg (8px) preferible
- **Shadow**: shadow-card (token M3)
- **Hover**: shadow-card-hover + translateY(-1px) para feedback tactil

### Densidad baja (forms, configuracion, modales)

- **Padding**: p-8 a p-10 (32px a 40px)
- **Font size**: 14px
- **Spacing entre campos**: gap-6 (24px)
- **Max campos visibles por pantalla**: 7
- **Width del form**: max-w-2xl (672px) centrado
- **Input height**: h-11 (44px) minimo para touch

---

## Decisiones de motion

### Transiciones estandar

- **Default hover**: transition-all duration-200 ease-cubic-bezier(0.32,0.72,0,1)
- **Page content entry**: opacity-0 translate-y-2 opacity-100 translate-y-0, duration-300, ease-out
- **Modal open/close**: opacity-0 scale-95 opacity-100 scale-100, duration-200
- **Button press**: active:scale-0.98, duration-100

### Spring physics vs CSS transitions

- **Cuando usar spring**: hover de cards, modal open/close, sidebar toggle, tab switching.
- **Cuando usar transiciones CSS simples**: color changes, opacity fades, state toggles binarios.
- **prefers-reduced-motion**: TODAS las animaciones deben ser respetuosas del preference del usuario.

### Lo que NO hacer con motion

- No animaciones decorativas sin proposito.
- No duracion mayor a 400ms.
- No animaciones que distraigan de la informacion critica.
- No linear easing — nunca transition: all linear.
- No animaciones en elementos con datos que cambian frecuentemente.

---

## Componentes firma (lo que diferencia vorTest)

1. **El Acta Header**: el bloque del Acta PDF (nombre, SHA-256 hash, timestamp) se muestra con borde m3-outline-variant y tipografia mono. Es el artefacto mas importante — debe verse como un documento oficial.

2. **Execution Status Bar**: barra de distribucion de resultados (passed/failed/skipped) horizontal, densa, con colores M3 semanticos. Un dato scaneable en 1 segundo sin leyenda que interpretar.

3. **Scope Indicator**: nombre del espacio activo + proyecto activo en el header usa m3-primary como color de enfasis. Aparece en TODAS las pantallas sin excepcion.

4. **Live Execution Indicator**: spinner animado con el texto Ejecutando en el header, conectado al WebSocket. Es la representacion visible del estado del sistema.

5. **Trace Viewer Badge**: badges que linkean a Playwright Trace Viewer usan m3-secondary con icono de open_in_new. Son claramente accionables y distintos de badges de status.

---

## Patrones a evitar (anti-AI-slop)

- No symmetric 3-column grids con even columnas de igual ancho.
- No centered hero sections — no hay hero en un dashboard.
- No card grids con todos los mismos elementos — al menos una debe tener peso visual diferente.
- No Leer mas o Ver todos al final de secciones.
- No avatar con iniciales circular como unico indicador de usuario.
- No sticky headers que ocupan 20% del viewport.
- No sidebar con iconos solos sin texto en desktop (mayor igual 1024px).
- No generic error messages — cada error tiene mensaje especifico y accion sugerida.

---

## Sistema de iconografia

- **Set principal**: material-symbols-outlined (constraint inquebrantable)
- **Filled vs outlined**: outlined para navegacion y acciones default; filled SOLO para el icono de la accion primaria en el CTA de una card.
- **Tamaños**: 16px (tablas), 20px (UI general), 24px (navegacion), 32px (empty states)
- **Color por defecto**: m3-on-surface-variant
- **Color para acciones**: m3-primary
- **Color para status**: m3-error, m3-tertiary, m3-warning
- **Icon-only buttons**: requieren siempre aria-label accesible.

---

## Sistema de elevacion (sombras)

| Nivel | Token / Clase | Uso |
|-------|---------------|-----|
| 0 (flat) | sin sombra | Filas de tabla, dividers |
| 1 | shadow-card | Cards estandar (espacios, proyectos, stat cards) |
| 2 | shadow-card-hover | Cards en hover — se combina con translateY(-1px) |
| 3 | shadow-modal | Modales, dropdowns, popovers |
| 4 | shadow-m3-elevation-4 | Snackbar, toast, tooltips |

---

## Sistema de borders y dividers

- **Hairline borders**: border border-m3-outline-variant (1px) — usado en cards, inputs, dividers horizontales
- **Dividers internos**: divide-y divide-m3-outline-variant en tablas y listas
- **Cards sin border, solo sombra**: patron default para stat cards y cards de dashboard.
- **Cards con border, sin sombra**: para cards densas de datos donde la sombra agregaria ruido.
- **Border radius**: rounded-lg (8px) es el default. rounded-xl (12px) solo para cards principales.

## Estados canonicos

| Estado | Senal visual | Implementacion |
|--------|-------------|----------------|
| Default | Superficie base sin modificadores | bg-m3-surface, texto m3-on-surface
| Hover | Elevacion +1, cursor pointer | shadow-sm -> shadow-md, bg-m3-surface-container-low
| Focus | Anillo de foco M3, 3px offset | ring-2 ring-m3-primary ring-offset-2
| Active/Pressed | Elevacion -1, escala 0.98 | shadow-md -> shadow-sm, scale-[0.98], bg-m3-surface-container-high
| Disabled | Opacidad 38%, cursor not-allowed | opacity-[0.38], text-m3-on-surface-variant
| Loading | Skeleton animado, no spinner en campos | bg-m3-surface-variant gradient-m3-skeleton, animate-pulse
| Error | Borde error, mensaje inline | border-m3-error, text-m3-error, ring-m3-error-ring en inputs
| Empty | Ilustracion + copy teach-not-lament, no叹息 | Ilustracion SVG + "No hay resultados aun. Ejecuta tu primer test."

> Regla: el estado empty NUNCA muestra un icono de error o una cara triste. Solo ilustracion util + CTA claro.

---

## Constraints inquebrantables

1. **NO dark mode**: solo light theme. Si alguien pide dark mode, se le dice que no.
2. **Solo fuentes autorizadas**: Archivo (headings), JetBrains Mono (code/numbers), Inter (UI labels).
3. **Solo M3 tokens**: cero hardcoded hex. Solo tokens del sistema M3.
4. **Solo material-symbols-outlined**: ningun otro icono. Variante outlined, no filled.
5. **Sidebar responsive inmutable**: lg=240px, md=72px, <md=drawer. No tocar.
6. **Solo spring physics**: ninguna animacion basada en duration/ease. Solo spring.
7. **NO touching Server Actions / RBAC / Prisma / workers**: eso no es trabajo de diseno.
8. **NO global tailwind config**: cada breakpoint es inline en el componente.
9. **NO componentes genericos**: cada componente signature tiene nombre y proposito unico.
10. **Copy en espanol con terminologia tester**: Acta, Caso de Prueba, Ejecucion, Modulo.

---

## Referencias visuales

### Directamente inspiradores
- **ReportPortal**: el standard para dashboards de test automation. Su jerarquia de datos (Launch > Suite > Test) es la que vorTest replica con Acta > Modulo > Caso. NO copiar su UI, pero SI su claridad informacional.
- **Playwright Trace Viewer**: la referencia para el modulo de reproduccion de ejecucion. El concepto de timeline + screenshot + log en columnas sincronizadas es el patron a seguir.
- **Linear**: la referencia para la calidad de interacciones. Sus micro-animaciones y spring physics son el objetivo. La velocidad de respuesta de Linear es el benchmark para vorTest.
- **Vercel Dashboard**: la referencia para densidad de informacion sin sobrecarga. Especialmente el modulo de deployments con su tabla compacta y cards de estadisticas.

### Que NO son de inspiracion
- Jenkins CI: estetica Enterprise Java de 2015. Evitar.
- CircleCI: funcional pero generico. No tiene caracter.
- GitHub Actions: funcional pero cold corporate. No aspiracional.
- Cypress Dashboard: buena UX pero fuera de scope. vorTest no es CI.

---

## Reglas de implementacion para Paso 5

1. **Cada componente en su archivo**: `components/ui/density/` + `components/ui/signature/`. NO archivos monoliticos.
2. **Tokens como props**: `<StatCard density="high" tone="positive" />`. Nunca hardcoded.
3. **Spring config centralizado**: `lib/spring-config.ts` con `STIFFNESS, DAMPING, MASS` por contexto.
4. **Breakpoints inline**: `className="hidden md:block lg:flex"`. No en tailwind.config.
5. **M3 tokens en CSS vars**: `var(--m3-primary)` en vez de `bg-primary`. bridge en tailwind.config.
6. **Signature components exportados**: `export { ExecutionTimeline } from "./signature/ExecutionTimeline"`.

---

## Implicaciones para Paso 4 (Impeccable)

### Tipografia
Archivo en h1-h4, JetBrains Mono en toda cifra o codigo. Inter en labels y metadata. Archivo NO aparece en body text.

### Color
Solo M3 tokens en TODA la UI. Ningun valor hardcoded. La paleta es: primary, on-primary, primary-container, secondary, tertiary, error, surface, surface-variant, outline, outline-variant, background.

### Layout
Sidebar 240px lg / 72px md / drawer <md. PageHeader en todas las rutas. Evidence-first en modulo Acta. Scope bar siempre visible en modulo Casos.

### Signature components
ExecutionTimeline, ActaHeader, ScopeBar, EmptyState: Estos cuatro componentes tienen implementacion obligatoria. Son el nucleo del caracter de vorTest.

### Motion
Spring physics en TODA interactividad. Zero CSS transitions. La unica exception es el skeleton loading que usa animate-pulse.

### Consistencia
Design tokens > componentes > paginas. Cada capa hereda de la anterior. No hay特例 (excepciones) sin justificacion escrita.
