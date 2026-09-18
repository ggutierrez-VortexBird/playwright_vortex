# Análisis de Usuario — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: mom-test, continuous-discovery
**Paso**: 1.2

## Resumen ejecutivo

vorTest tiene tres roles de usuario claramente diferenciados en el código: **superadmin** (configura espacios, supervisa salud general), **admin** (gestiona proyectos y casos de prueba), y **tester** (ejecuta tests y revisa evidencia). Cada rol opera en capas distintas de la jerarquía y tiene jobs diferentes. La investigación de usuario está limitada a inferencia basada en roles documentados y features visibles — no hay acceso a usuarios reales para validar. Las proto-personas siguientes son hipótesis de trabajo, no insights validados con usuarios.

## Proto-Personas (basadas en roles RBAC existentes)

### Persona 1: La Tester — Valentina, 28 años, QA Engineer

**Contexto**: Trabaja en un equipo de 4 QA para un producto SaaS B2B. Es quien más tiempo pasa en vorTest semanalmente.

**Motivaciones**:
- Quiere que cuando un build falle, pueda reportar el bug con evidencia sólida (video + screenshots + trace) sin tener que reproducirlo localmente
- Quiere grabar nuevos casos de prueba sin escribir código — el recorder es su punto de entrada
- Quiere saber en qué estado está cada ejecución: ¿terminó? ¿falló? ¿en qué paso?
- Quiere compartir el Acta con developers y PMs sin tener que exportar manualmente

**Frustraciones**:
- No sabe si una ejecución está corriendo o se colgó — no hay feedback visual claro
- Para revisar evidencia de una ejecución fallida tiene que hacer click en múltiples lugares antes de encontrar el error
- El recorder (Codegen) le parece complejo — no sabe si el script que grabó va a funcionar en producción
- Los estados vacíos (sin casos, sin ejecuciones) no le enseñan qué hacer

**Jobs que contrata a vorTest**:
- "When a build fails in CI, I want to immediately see what failed and with what evidence, so I can file a bug report with proof that developers can't dismiss"
- "When a new test case is described in a ticket, I want to record it in 5 minutes without asking a developer, so it's not left as 'untested'"

**Touchpoints semanales**: revisión de ejecuciones fallidas (3-5x/semana), grabación de 1-2 casos nuevos, revisión de evidencia con developers, actualización de casos flaky.

### Persona 2: El Admin — Marcos, 34 años, QA Lead

**Contexto**: Gestiona el espacio de QA de su organización. Tiene 2 testers bajo su supervisión y 3 proyectos activos.

**Motivaciones**:
- Quiere mantener la suite de tests sana — detectar casos flaky antes de que erosonen la confianza del equipo
- Quiere que cuando presente métricas a stakeholders, los números sean claros y la evidencia esté accesible
- Quiere que la configuración de nuevos proyectos sea rápida y reutilizable

**Frustraciones**:
- No tiene visibilidad agregada de salud de tests por proyecto — tiene que ir proyecto por proyecto
- Cuando un tester graba un caso con el recorder, no sabe si el script generado es óptimo o tiene code smells
- La configuración de workers y entornos de ejecución es repetitiva

**Jobs que contrata a vorTest**:
- "When I present test health to stakeholders, I want one dashboard showing pass/fail rates and evidence, so I don't spend hours compiling a report manually"
- "When a tester creates a new case, I want it to follow our naming conventions automatically, so the project stays organized"

**Touchpoints semanales**: dashboard de salud (2-3x/semana), revisión de casos nuevos (daily), análisis de casos flaky (1x/semana), configuración de nuevos proyectos (ocasional).

### Persona 3: La Superadmin — Laura, 40 años, VP of Engineering

**Contexto**: Administra múltiples espacios de trabajo para diferentes equipos. No usa vorTest diariamente pero necesita visibilidad ejecutiva.

**Motivaciones**:
- Quiere saber si los equipos de QA están siendo efectivos con la automatización
- Quiere tomar decisiones sobre dónde invertir (¿equipo A necesita más cobertura? ¿equipo B tiene demasiados tests flaky?)

**Frustraciones**:
- No tiene una vista agregada que compare salud de tests entre espacios
- Los reportes que recibe son difíciles de interpretar sin contexto de qué es "normal"

**Jobs que contrata a vorTest**:
- "When I review multiple QA teams, I want to see a health summary per space, so I can allocate engineering investment where it matters most"

**Touchpoints semanales**: dashboard ejecutivo (1x/semana review), decisiones de inversión (mensual).

## Patrones de Uso Inferidos

| Rol | Frecuencia | Acciones principales | Artefacto clave |
|-----|-----------|-------------------|----------------|
| Tester | Diaria | Ejecutar, revisar evidencia, grabar casos | Acta (PDF + video) |
| Admin | Semanal | Gestionar casos, ver salud, configurar | Dashboard de proyecto |
| Superadmin | Semanal/Mensual | Ver métricas agregadas | Reporte ejecutivo |

## Pain Points Inferidos

1. **Feedback de ejecución**: sin acceso a WebSocket en vivo, el tester no sabe el estado de una ejecución larga — refresh manual
2. **Descubrimiento de evidencia**: la evidencia está nested dentro de ejecuciones — para llegar al video hay que hacer 3-4 clicks
3. **Estados vacíos**: la primera vez que un tester entra a un proyecto nuevo sin casos, no hay guía sobre qué hacer — no hay onboarding flow
4. **Scroll infinito en tablas**: con cientos de ejecuciones, las tablas de resultados son densas y difíciles de escanear visualmente
5. **Scope visual difuso**: sin señal clara del espacio/proyecto activo, es fácil operar en el contexto equivocado

## Implicaciones para el rediseño UI

- **El tester es el usuario más frecuente y debe ser priorizado**: la UI debe optimizarse para revisión rápida de evidencia fallida
- **El primer error de una ejecución debe estar visible en los primeros 200px**: no hay que scroll para encontrar qué falló
- **El recorder (Codegen) debe tener un onboarding flow**: estados vacíos deben enseñar, no solo lamentar
- **El espacio activo y proyecto activo deben ser visibles en todo momento**: la jerarquía debe ser un breadcrumb siempre presente
- **Las métricas de salud deben estar accesibles para admins sin ir a múltiples pantallas**: dashboard unificado por proyecto
- **Superadmin necesita una vista comparativa entre espacios**: no tiene sentido que tenga que entrar a cada espacio individualmente

## Fuentes / Referencias

- Skills: mom-test (Rob Fitzpatrick), continuous-discovery (Teresa Torres)
- Proto-personas basadas en: roles RBAC en lib/auth.ts (superadmin, admin, tester), estructura de dominio (Espacio/Proyecto/CasoPrueba/Ejecucion/Acta), features visibles (recorder, worker, WebSocket, PDF generation)
- **SUPOSICIÓN CRÍTICA**: no hay acceso a usuarios reales. Estas personas son inferencias de trabajo basadas en roles documentados y features. Deben validarse con research real antes de tomar decisiones de diseño irreversibles.
- Metodología: Mom Test no puede aplicarse sin conversaciones reales — se usó para estructurar qué preguntas habría que hacer si se tuviera acceso a usuarios
