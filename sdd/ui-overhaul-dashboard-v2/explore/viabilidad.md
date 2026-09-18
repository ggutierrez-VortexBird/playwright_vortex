# Análisis de Viabilidad — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: lean-startup
**Paso**: 1.4

## Resumen ejecutivo

vorTest está en etapa temprana de producto — aún no ha validado product-market fit. El redesign UI debe priorizarse en función de las métricas que van a indicar si el producto está resolviendo los jobs correctos para los usuarios correctos. Las métricas vanidosas (total de usuarios, total de ejecuciones) son inútiles para tomar decisiones; las métricas accionables (tiempo de revisión de evidencia, tasa de éxito por caso) son las que importan. El framework Build-Measure-Learn sugiere que el redesign debe ir acompañado de instrumentation básica para poder medir el impacto de cada cambio en las métricas clave.

## Métricas Accionables (no vanity)

### Para el tester (usuario más frecuente)

| Métrica | Definición | Por qué importa |
|---------|-----------|----------------|
| **Tiempo de revisión de evidencia fallida** | Tiempo entre que el tester ve "ejecución fallida" y encuentra el primer error | Si es >30 segundos, la UI tiene un problema de discoverability |
| **Tasa de clicks para llegar al video** | Número de clicks desde la lista de ejecuciones hasta el video del trace | Debería ser ≤2 clicks |
| **Tasa de completación del recorder** | % de sesiones de recorder que terminan en un script ejecutable | Baja tasa = onboarding deficiente o recorder defectuoso |
| **Frecuencia de ejecución por tester** | Veces que un tester ejecuta tests por semana | Baja = no confían en los resultados o la UI es confusa |

### Para el admin (usuario operador)

| Métrica | Definición | Por qué importa |
|---------|-----------|----------------|
| **Pass/fail rate por proyecto** | % de tests que pasan vs. fallan, actualizado por ejecución | Indicador de salud de la suite |
| **Tasa de casos flaky** | % de casos que fallan en una ejecución y pasan en la siguiente | Un flaky rate >10% erosonea la confianza del equipo |
| **Tiempo de setup de nuevo caso** | Tiempo entre que el admin crea un caso y la primera ejecución exitosa | Setup >15 minutos = fricción alta |
| **Frecuencia de uso del dashboard** | Veces que el admin visita el dashboard por semana | Baja = el dashboard no resuelve su job |

### Para el superadmin (usuario estratégico)

| Métrica | Definición | Por qué importa |
|---------|-----------|----------------|
| **Salud agregada por espacio** | Pass/fail rate promedio por espacio, actualizado weekly | Permite decisiones de inversión |
| **Cobertura de tests por proyecto** | # de casos por proyecto / líneas de código o features | Indica madurez de la suite |
| **Tendencia de flaky rate en el tiempo** | Flaky rate mes a mes | Si sube, hay un problema de quality |

## Métricas Vanity a EVITAR

| Métrica vanity | Por qué es inútil | Alternativa accionable |
|---------------|------------------|----------------------|
| Total de usuarios registrados | No indica si usan el producto | MAU (monthly active users) con frecuencia |
| Total de ejecuciones | Crece con el tiempo sin contexto | Ejecuciones por tester por semana (engagement) |
| Total de casos creados | No indica si se ejecutan | Tasa de ejecución: casos creados vs. casos ejecutados en 30 días |
| Número de espacios | No indica salud | Pass/fail rate agregado por espacio |

## Build-Measure-Learn para el Redesign

### Ciclo 1: Hypothesis — Feedback de ejecución en vivo

**Build**: Mostrar indicadores de estado de ejecución (running, success, failed) con WebSocket en la UI principal, no solo en la página de detalle.

**Measure**: Tiempo entre inicio de ejecución y primer estado visible. Tasa de usuarios que hacen refresh manual durante ejecución.

**Learn**: Si los usuarios hacen menos refresh, el WebSocket feedback es valioso. Si no, puede que el estado no sea el bottleneck.

### Ciclo 2: Hypothesis — Onboarding del recorder

**Build**: Estados vacíos con flujos de onboarding guiado para el recorder (3 pasos: grabar, revisar, exportar).

**Measure**: Tasa de completación del onboarding. Tasa de scripts generados que se ejecutan sin error en la primera vez.

**Learn**: Si la tasa de completación >70% y los scripts funcionan, el onboarding está bien diseñado. Si no, hay que simplificar el recorder o la guía.

### Ciclo 3: Hypothesis — Dashboard de salud para admins

**Build**: Dashboard unificado de proyecto con pass/fail rate, tendencia de flaky, y últimas ejecuciones fallidas.

**Measure**: Frecuencia de visita al dashboard por admin por semana. Comparar con frecuencia de uso de spreadsheets para el mismo job.

**Learn**: Si el dashboard reduce uso de spreadsheets, es un diferenciador real. Si no, puede que los admins prefieran su spreadsheets.

## Pivot o Perseverar

vorTest está en **Phase 2 (Product/Market Fit)** del framework Lean Startup — tiene un MVP funcional pero no ha validado que los usuarios principales (testers) estén tan engagementados que el producto sea sticky.

**Señales de perseverar**:
- Tasa de ejecución semanal por tester >5 (testers usan vorTest regularmente)
- Flaky rate <10% (la suite es confiable)
- Tasa de retorno semanal >60% (admins vuelven cada semana)

**Señales de pivot**:
- Engagement de testers no crece tras 3 iteraciones de UI
- El recorder no se usa (>80% de casos creados por developers, no por testers)
- Users churn después del primer mes

**Decisión actual**: el redesign UI debe enfocarse en el **engagement del tester** (usuario más frecuente) porque es el que determina si el producto se usa o se abandona. Si los testers no vuelven, no hay datos para admins ni superadmins.

## Implicaciones para el rediseño UI

- **Cada pantalla debe responder a una métrica accionable**: no hay pantallas decorativas — cada vista debe estar instrumentada
- **El redesign debe incluir instrumentation básica**: por mínimo, tracking de: tiempo para primer error, clicks hasta video, frecuencia de uso por rol
- **Estados vacíos son oportunidades de aprendizaje**: el onboarding del recorder debe enseñarle al tester qué hacer, no solo mostrar "no hay casos"
- **El dashboard de admin debe ser la homepage del rol admin**: accesible en 1 click desde cualquier lugar del proyecto
- **Feedback de ejecución en vivo (WebSocket) debe estar prominente**: no escondido en un tab — visible en la barra de estado o header

## Fuentes / Referencias

- Skill: lean-startup (Eric Ries) — Build-Measure-Learn, Innovation Accounting, Actionable vs Vanity Metrics
- Métricas basadas en: features del codebase (WebSocket, recorder, dashboard proposals), roles RBAC, hipótesis de producto
- **SUPOSICIÓN CRÍTICA**: no hay datos históricos de métricas en vorTest. Estas métricas son las que un equipo de producto debería instrumentar, no las que ya existen. Implementar analytics (ej. PostHog, Plausible) es un prerequisite para medir el impacto del redesign.
- Validation ladder: actualmente vorTest está en Level 2-3 ("customers said they want this" / "customers signed up for early access") — necesita llegar a Level 4-5 antes de escalar
