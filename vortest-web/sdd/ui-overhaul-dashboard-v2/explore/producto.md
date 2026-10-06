# Análisis de Producto — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: jobs-to-be-done, lean-ux
**Paso**: 1.3

## Resumen ejecutivo

El análisis de Jobs to Be Done revela que vorTest debe resolver tres jobs funcionales centrales: (1) ejecutar tests y obtener evidencia auditable, (2) grabar casos de prueba sin código, y (3) reportar salud de tests a stakeholders. Las hipótesis de diseño derivadas del Lean UX framework sugieren cambios concretos en la UI que podrían mejorar la tasa de éxito en revisión de evidencia y reducir el tiempo de setup de nuevos casos. Las suposiciones más riesgosas son las que no tenemos forma de validar sin usuarios reales: la disposición a pagar por evidencia auditável en lugar de screenshots manuales, y si testers no-técnicos realmente usarían el recorder en vez de pedir ayuda a developers.

## Jobs to Be Done (JTBD)

### Job 1: Evidencia auditable tras un build fallido

**Cuándo**: Cuando un build en CI falla o un tester detecta una regresión en un entorno staging.

**Yo quiero**: Ver exactamente qué pasó en el test — qué paso falló, qué elementos se encontraron vs. qué se esperaban, qué logs generó Playwright — con video y screenshots sincronizados.

**Para poder**: Reportar el bug con evidencia que developers no puedan cuestionar, y que tenga valor legal en auditorías regulatorias.

**Dimensiones**:
- Funcional: obtener trace de Playwright + video + screenshots en un formato que se pueda archivar
- Emocional: sentirme seguro de que la evidencia no se puede cuestionar ("audit confidence")
- Social: presentar evidencia profesional ante developers y PMs que demuestra rigor

**Fuerzas (según JTBD)**:
- Push: evidencia manual (screenshots tomados a mano) es tediosa y no se puede compartir fácilmente
- Pull: video sincronizado con cada paso del test + hash SHA-256 = evidencia inmutable
- Anxiety: ¿el video realmente captura todo o hay un bug que solo pasa en prod?
- Habit: seguir haciendo screenshots manuales porque "siempre funcionó"

### Job 2: Grabar un caso de prueba sin escribir código

**Cuándo**: Cuando un PM o lead describe un nuevo scenario de prueba en un ticket o grooming.

**Yo quiero**: Abrir el recorder, hacer click en la interfaz como usuario normal, y que se genere un script Playwright válido que pueda ejecutarse inmediatamente.

**Para poder**: Crear un caso de prueba nuevo sin tener que esperar a un developer, y sin aprender la sintaxis de Playwright.

**Dimensiones**:
- Funcional: recorder que exporta a scripts ejecutables
- Emocional: sentirse autónomo, no depender de otros para crear tests
- Social: demostrar que QA puede hacer automatización sin ayuda de ingeniería

**Fuerzas**:
- Push: escribir scripts Playwright requiere conocimiento de TypeScript y locators
- Pull: Codegen integrado que graba acciones reales del browser
- Anxiety: ¿el script grabado va a funcionar en todos los browsers? ¿va a ser maintainable?
- Habit: pedirle a un developer que escriba el test

### Job 3: Reportar salud de tests a stakeholders

**Cuándo**: En las weekly reviews o cuando un release está cerca y se necesita confidence.

**Yo quiero**: Un dashboard que muestre pass/fail rate, tendencia de flaky tests, y evidencia de las últimas ejecuciones fallidas — todo accesible en 2 clicks.

**Para poder**: Presentar un reporte a stakeholders sin tener que compilar datos manualmente de múltiples fuentes.

**Dimensiones**:
- Funcional: métricas agregadas por proyecto y por espacio
- Emocional: proyectar competence y control sobre el proceso de QA
- Social: demostrar ROI de la automatización a management

**Fuerzas**:
- Push: compilar reportes a mano toma horas y es propenso a errores
- Pull: dashboard con métricas accionables y evidencia linked
- Anxiety: ¿si presento un número, alguien va a cuestionar la metodología?
- Habit: seguir usando spreadsheets para tracking

### Job 4: Diagnosticar un test flaky

**Cuándo**: Cuando un test pasa y falla alternadamente sin cambios en el código.

**Yo quiero**: Ver el historial de ejecuciones del caso, los traces de cada ejecución, y сравнить qué cambió entre la ejecución que pasó y la que falló.

**Para poder**: Identificar la causa raíz del flakiness y fixearlo sin necesidad de reproducirlo localmente.

**Dimensiones**:
- Funcional: historial de ejecución por caso, comparison de traces
- Emocional: sentir que tengo инструменты para resolver el problema, no que estoy adivinando
- Social: poder justificar ante el equipo por qué un test es flaky

### Job 5: Configurar un nuevo proyecto rápidamente

**Cuándo**: Cuando se suma un nuevo equipo o producto que necesita su propia suite de tests.

**Yo quiero**: Clonar la configuración de un proyecto existente (workers, entornos, patterns de naming) y tener la estructura lista en minutos.

**Para poder**: Empezar a ejecutar tests sin perder tiempo en configuración repetitiva.

**Dimensiones**:
- Funcional: templates de proyecto, clonación de configuración
- Emocional: evitar frustración de hacer el setup desde cero
- Social: demostrar eficiencia al equipo nuevo

## Hipótesis de Diseño (Lean UX)

### Hipótesis 1: Revisión de evidencia más rápida

**Creemos que**: si el panel de ejecución fallida muestra el primer error en los primeros 200px de viewport sin scroll, con video thumbnail y trace link accesibles en un click.

**Mediremos**: tiempo que tarda el tester en identificar el primer error (debería bajar de ~45 segundos a ~15 segundos).

**Evidencia actual**: no existe medición — no hay analytics de tiempo de revisión.

### Hipótesis 2: Onboarding del recorder

**Creemos que**: si el recorder tiene un flujo de onboarding de 3 pasos la primera vez que se abre (grabar → revisar → exportar), más testers no-técnicos van a completar la creación de un caso sin pedir ayuda.

**Mediremos**: tasa de completación de casos creados con recorder vs. creados por developers.

**Evidencia actual**: inferencia — el recorder existe pero no hay guidance.

### Hipótesis 3: Dashboard de salud para admins

**Creemos que**: si el dashboard de proyecto muestra pass/fail rate, tendencia de flaky, y últimas 5 ejecuciones fallidas en una sola vista, los admins van a preferir vorTest sobre spreadsheets para reporting.

**Mediremos**: frecuencia de uso del dashboard (DAU/MAU) y tasa de retención semanal.

**Evidencia actual**: no hay dashboard unificado visible — la información está dispersa.

## Suposiciones a Validar (riesgo alto)

1. **Los testers no-técnicos van a usar el recorder**: inferimos que sí, pero no hay evidencia de uso real
2. **La evidencia con hashes SHA-256 tiene valor premium sobre screenshots manuales**: asumimos que sí para industrias reguladas
3. **Los admins van a usar el dashboard en vez de spreadsheets**: no hay data de conversión de spreadsheets a vorTest
4. **El video de Playwright trace es suficiente para debugging**: podría ser que los developers prefieran logs de CI directamente
5. **El pricing es comparable a la alternativa (tiempo de crear evidencia manual)**: no tenemos datos de willingness to pay

## Implicaciones para el rediseño UI

- **Jerarquía visual: evidencia > configuración**: los artefactos (video, trace, screenshots) deben tener prominencia visual sobre los settings
- **El recorder debe tener estado vacío con onboarding**: no un botón perdido en un menú
- **El dashboard de salud debe existir como pantalla principal de admin**: no como un tab secundario
- **Las tablas de ejecución deben ser scaneables**: highlight del primer error, colores de status claros, timestamps prominentes
- **El trace viewer de Playwright debe estar embebido o linkeado claramente**: no escondido en un archivo JSON que hay que descargar

## Fuentes / Referencias

- Skills: jobs-to-be-done (Christensen, Hall, Dillon, Duncan), lean-ux (Gothelf, Seiden)
- JTBD statements basadas en features visibles: worker.ts (ejecución), recorder-worker.ts (Codegen), PDF generation (Acta), trace export
- Hipótesis de diseño basadas en principio de Lean UX: outcomes over outputs, lowest-fidelity experiment
- **SUPOSICIÓN CRÍTICA**: sin usuarios reales no hay forma de validar los JTBD. Estas statements son inferencias lógicas del dominio. Un coach de producto experimentado podría validar algunas, pero la única validación real viene de conversaciones con usuarios según mom-test.
