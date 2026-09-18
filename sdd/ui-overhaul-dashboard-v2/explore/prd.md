# Product Requirements Document — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: inspired-product
**Paso**: 1.5 (INTEGRADOR)

## Resumen ejecutivo

vorTest es una plataforma de evidencia de tests Playwright con ejecución in-house, evidence auditável (PDF + video + screenshots + traces con hashes SHA-256), y RBAC jerárquico por Espacio/Proyecto. El producto atiende a tres roles: testers que ejecutan y graban, admins que gestionan proyectos y supervisan salud, y superadmins que necesitan visibilidad agregada entre espacios. El problema central que vorTest resuelve no es "gestión de tests" — es **"generar evidencia de testing que nadie pueda cuestionar"**. Este documento consolida los hallazgos de investigación de mercado, usuario, producto y viabilidad en un PRD accionable para guiar el rediseño de UI.

---

## 1. Problema Central

vorTest necesita una UI que:

1. **Priorice evidencia auditable sobre configuración**: los artefactos (Acta PDF, video, trace) son el producto final del usuario — deben dominar visualmente sobre settings y formularios
2. **Sea densa en información pero no abrumadora**: testers necesitan ver mucho dato (status, errores, historial) pero sin ruido visual
3. **Respete la jerarquía Espacio/Proyecto con scoping visual claro**: el espacio activo debe ser visible en todo momento como señal de contexto, evitando que el usuario opere en el espacio equivocado
4. ** soporte feedback en vivo durante ejecuciones**: el WebSocket que ya existe debe estar prominentemente visible, no escondido

---

## 2. Personas (sintetizadas de usuario.md)

### Valentina — QA Engineer (Tester)
- **Rol en el sistema**: tester
- **Frecuencia**: diaria
- **Job principal**: ejecutar tests y revisar evidencia fallida para reportar bugs con prueba
- **Pain point más crítico**: no sabe si una ejecución está corriendo o colgada; para encontrar el primer error tiene que hacer múltiples clicks y scroll
- **Cómo mide éxito**: tiempo entre ver "failed" y encontrar el primer error (<30 segundos ideal)

### Marcos — QA Lead (Admin)
- **Rol en el sistema**: admin
- **Frecuencia**: semanal
- **Job principal**: mantener la suite sana y presentar métricas a stakeholders
- **Pain point más crítico**: no tiene dashboard unificado — tiene que ir proyecto por proyecto o compilar en spreadsheets
- **Cómo mide éxito**: tiempo que tarda en armar un reporte de salud de tests (<5 minutos ideal)

### Laura — VP of Engineering (Superadmin)
- **Rol en el sistema**: superadmin
- **Frecuencia**: semanal/mensual
- **Job principal**: visibilidad agregada entre espacios para decisiones de inversión
- **Pain point más crítico**: no hay vista comparativa de salud entre espacios
- **Cómo mide éxito**: puede ver salud de 5 espacios en menos de 2 minutos

---

## 3. Jobs to Be Done — Top 5 (sintetizados de producto.md)

1. **"When a build fails, I want to see exactly what failed with video + trace evidence, so I can file a bug report that developers can't dismiss"**
   — Evidencia auditable tras ejecución fallida (tester)

2. **"When a new test case is described in a ticket, I want to record it in 5 minutes without writing code, so it's not left as 'untested'"**
   — Grabación de casos sin código (tester)

3. **"When I present test health to stakeholders, I want one dashboard with pass/fail rate and evidence, so I don't spend hours compiling a report manually"**
   — Reporte de salud para admins (admin)

4. **"When a test is flaky, I want to see the execution history and compare traces, so I can identify the root cause without reproducing it locally"**
   — Diagnóstico de tests flaky (admin/tester)

5. **"When there are multiple spaces, I want to see health summary per space, so I can decide where to invest engineering time"**
   — Visibilidad agregada para superadmin (superadmin)

---

## 4. Mercado y Positioning (sintetizado de mercado.md)

**Categoría**: Playwright-native Test Evidence Platform

**Diferenciación contra alternativas**:

| Alternativa | Por qué vorTest es mejor |
|-------------|-------------------------|
| Spreadsheets + Google Drive | vorTest tiene ejecución automática + evidencia inmutable + historial |
| Jenkins + Allure | Scoping por Espacio/Proyecto + RBAC + Acta PDF 1:1 |
| ReportPortal | Recorder integrado + evidencia de video + RBAC jerárquico |
| TestRail/Xray | Ejecución automática real, no manual |

**Competitive positioning**:
> Para equipos de QA que necesitan evidencia auditable de pruebas automatizadas, vorTest es la plataforma de evidencia Playwright que genera actas inmutables con video y hashes SHA-256.

---

## 5. Métricas Accionables (sintetizadas de viabilidad.md)

| Métrica | Target | Rol |
|---------|--------|-----|
| Tiempo de revisión de evidencia fallida | <30 seg (de <45 seg actual) | Tester |
| Clicks hasta video | ≤2 clicks | Tester |
| Tasa de completación del recorder onboarding | >70% | Tester |
| Pass/fail rate visible por proyecto | actualizado por ejecución | Admin |
| Flaky rate por proyecto | <10% | Admin |
| Tiempo de setup de nuevo caso | <15 min | Admin |
| Salud agregada por espacio | vista en <2 min | Superadmin |
| DAU/MAU de dashboard | >60% admins vuelven semanalmente | Admin |

**Instrumentation prerequisite**: el redesign debe acompañarse de instrumentation básica (PostHog, Plausible, o similar) para medir estas métricas. Sin datos, no hay forma de validar que el redesign mejora algo.

---

## 6. Criterios de Diseño Derivados

Estos son los criterios que el equipo de diseño DEBE respetar. No son opcionales.

### Criterio 1: Evidencia domina sobre configuración
La evidencia (Acta, video, trace, screenshots) debe ocupar el área visual principal. Los settings y formularios de configuración no deben competir en prominencia con los artefactos de testing. El tester debe ver evidencia antes de ver opciones.

**Validación**: en cada pantalla, pregúntate — si un tester entra sin contexto, ¿ve los artefactos o los settings primero?

### Criterio 2: Scope visual siempre presente
El nombre del Espacio activo y el Proyecto activo deben estar en el header o breadcrumb en TODAS las pantallas de la aplicación. Si el usuario no sabe en qué contexto está, puede operar en el espacio equivocado — esto tiene consecuencias en un sistema con RBAC jerárquico.

**Validación**: cualquier pantalla sin señal de scope visible es un bug de diseño, no una decisión neutral.

### Criterio 3: Densidad alta en tablas, baja en formularios
Las tablas de ejecución deben ser densas: timestamps, status con color, error preview en columnas. Los formularios (configuración de caso, settings de proyecto) deben tener whitespace generoso y no más de 5-7 campos visibles por pantalla.

**Validación**: una tabla de ejecuciones con 500 filas debe ser scaneable en 10 segundos. Un formulario de setup no debe requerir scroll.

### Criterio 4: Estados vacíos deben enseñar, no solo lamentar
Cuando no hay casos, no hay ejecuciones, o no hay evidencia — el estado vacío debe incluir guidance clara sobre qué hacer. Para el recorder, el estado vacío debe mostrar un onboarding flow, no solo un botón.

**Validación**: un tester que nunca usó vorTest debe poder grabar su primer caso sin leer documentación.

### Criterio 5: Feedback de ejecución en vivo prominente
El WebSocket que ya existe en el backend debe reflejarse en la UI con indicadores de estado en el header (running spinner, last execution timestamp). El usuario no debe tener que entrar a la página de detalle para saber si una ejecución está corriendo.

**Validación**: el indicador de "running" debe ser visible desde cualquier pantalla del proyecto, no solo desde la lista de ejecuciones.

### Criterio 6: Primer error visible en 200px
En la vista de detalle de una ejecución fallida, el primer error (stack trace, screenshot del momento del failure) debe estar en los primeros 200px verticales del viewport — sin scroll, sin expandir secciones.

**Validación**: en una pantalla de 768px de altura, el tester debe ver el error sin hacer scroll.

### Criterio 7: Recorder accesible como funcionalidad de primera clase
El recorder (Codegen) no debe ser un tab olvidado en un submenú. Debe ser accesible desde la barra principal o desde el estado vacío de "sin casos". El flujo de onboarding (grabar → revisar → exportar) debe estar embebido en la UI.

**Validación**: un tester debe poder encontrar y usar el recorder en menos de 3 clicks desde cualquier pantalla.

### Criterio 8: Dashboard de salud como homepage de admin
La pantalla principal del rol admin debe ser un dashboard de salud del proyecto actual — pass/fail rate, tendencia de flaky, últimas ejecuciones fallidas — no una lista de casos.

**Validación**: el admin que entra a vorTest debe ver métricas antes de ver una lista.

---

## 7. Out of Scope Explícito

El redesign de UI NO incluye:

- **Plataforma SaaS nueva**: vorTest es self-hosted, in-house. No compite con modelos SaaS multi-tenant.
- **Gestión de casos manuales**: no es TestRail — no se agregan casos manualmente sin ejecución Playwright.
- **Mobile nativo**: es web responsive. No hay apps iOS/Android en el roadmap.
- **Lógica de negocio**: el redesign es UI-only. No se toca Prisma schemas, API routes, worker logic, o autenticación.
- **Logo ni naming**: el nombre "vorTest" y el logo actual no cambian.
- **Feature flags ni monetización**: no hay cambios en pricing ni modelos de negocio.

---

## 8. Suposiciones Explícitas

1. **No hay usuarios reales validados**: todas las personas, jobs, y pain points son inferencias basadas en roles RBAC documentados y features visibles en el código. Esto es investigación de escritorio, no user research.

2. **Los testers no-técnicos van a usar el recorder**: no hay evidencia de uso real. El recorder puede no estar listo para usuarios no-developers.

3. **La evidencia con hashes SHA-256 tiene valor premium**: asumimos que sí para industrias reguladas, pero no hay feedback de usuarios en esos sectores.

4. **Los admins prefieren dashboard sobre spreadsheets**: no hay data de conversión. Puede que los admins ya tengan workflows de reporting que no van a abandonar.

5. **El WebSocket feedback es útil**: lo inferimos de la arquitectura, pero no hay métricas de uso que confirmen que usuarios hacen refresh manual durante ejecuciones.

6. **La instrumentación básica no está implementada**: antes de este redesign, no hay forma de medir el impacto. Se asume que se va a agregar PostHog o similar.

**Recomendación antes de Paso 2**: estas suposiciones deben validarse con al menos 3-5 conversaciones con usuarios reales (testers y admins) antes de congelar el diseño. Sin esa validación, el redesign está basado en hipótesis, no en evidencia.

---

## 9. Correcciones a Incorporar en el Diseño (5 Suposiciones como Hedge)

El usuario pidió tener TODAS las suposiciones en cuenta para corregir el diseño. Cada suposición se traduce en una **acción concreta de diseño** que actúa como hedge — si la hipótesis resulta incorrecta, el rediseño no se rompe.

### Corrección 1 — Recorder adoption (de Suposición 2)
**Hipótesis**: testers no-técnicos usan el recorder.
**Hedge de diseño**: el recorder es una **puerta de entrada visible** pero NO la única. El dashboard debe seguir funcionando perfectamente para QA engineers que escriben Playwright directo.
- CTA del recorder aparece en: estado vacío de "sin casos" + header de detalle de caso existente (para variantes)
- Pero NO reemplaza la importación directa de scripts
- **Métrica para invalidar**: si <40% de testers usan el recorder post-redesign, reevaluar prominence

### Corrección 2 — Evidencia SHA-256 premium (de Suposición 3)
**Hipótesis**: evidencia inmutable con hashes SHA-256 es valuable para industrias reguladas.
**Hedge de diseño**: la **evidencia visual** (video, screenshots, trace) es la primera capa — siempre visible. Los **hashes SHA-256** son segunda capa técnica, accesible pero no dominante. Si los usuarios no valoran inmutabilidad, la evidencia visual sigue funcionando.
- **Métrica para invalidar**: si usuarios no abren el acta PDF ni descargan artefactos, el value prop de inmutabilidad está roto

### Corrección 3 — Admins prefieren dashboard sobre spreadsheets (de Suposición 4)
**Hipótesis**: admins usarán el dashboard en lugar de compilar reportes manuales.
**Hedge de diseño**: el dashboard de salud **complementa** los reportes externos, no los reemplaza.
- Ofrece vistas exportables (CSV, JSON) para alimentar workflows existentes
- Si el admin no encuentra valor, no se rompe nada — el reporte manual sigue siendo posible
- **Métrica para invalidar**: si la exportación CSV/JSON no se usa, el dashboard no sirve al workflow real

### Corrección 4 — WebSocket feedback útil (de Suposición 5)
**Hipótesis**: testers hacen refresh manual durante ejecuciones largas.
**Hedge de diseño**: el indicador "running" en el header debe ser **opcional y dismissable** — si el usuario no quiere ver el spinner, lo apaga. Si no es útil, no agrega ruido.
- La página de detalle sigue siendo el lugar canónico para progreso completo
- **Métrica para invalidar**: si el indicador se dismissa en >60% de sesiones, el WebSocket feedback no resuelve problema real

### Corrección 5 — Hay usuarios reales suficientes (de Suposición 1)
**Hipótesis**: hay 3-5 testers/admins que usarían vorTest.
**Hedge de diseño**: el diseño debe ser **elegante para 1 usuario** (tester con muchos casos) Y **comprehensible para 10+ usuarios** (admin con vista agregada).
- Funciona con 1-2 usuarios (no se rompe por falta de escala)
- Escala a 50+ usuarios sin cambios arquitectónicos
- **Métrica para invalidar**: si el diseño falla con 1 usuario O con 50 usuarios, no resuelve el rango esperado

### Hedge global: Instrumentation primero
Ninguna de las 5 suposiciones se puede validar sin instrumentation. El redesign debe incluir instrumentation mínima (page views, click heatmaps, event tracking) **ANTES** de iteraciones de UI. Sin esto, todo el rediseño es un acto de fe.

---

## 10. Próximos Pasos

1. **Validar suposiciones críticas** (especialmente uso del recorder y valor de evidencia SHA-256)
2. **Instrumentar métricas accionables** (PostHog o similar como prerequisite)
3. **Aplicar las 5 correcciones de diseño** de la sección 9 en cada pantalla que corresponda
4. **Generar mockups de alta fidelidad** siguiendo los 8 criterios de diseño
5. **Test de usabilidad con testers reales** antes de implementar
6. **Prioritizar por engagement del tester** — si testers no usan vorTest, admins y superadmins no tienen datos

---

## Fuentes / Referencias

- Skills: inspired-product (Marty Cagan / SVPG), obviously-awesome, mom-test, continuous-discovery, jobs-to-be-done, lean-ux, lean-startup
- Documentosbase: mercado.md, usuario.md, producto.md, viabilidad.md (todos en este directorio)
- Código base analizado: lib/auth.ts (RBAC), estructura de dominio (Prisma schema), scripts/worker.ts, scripts/recorder-worker.ts
- **Tipo de investigación**: desk research + análisis de producto (no user research real)
