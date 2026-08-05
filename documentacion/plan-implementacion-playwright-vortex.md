# ACTA — Plan de implementación

## 1. Arquitectura general

**Stack:**
- Next.js (App Router, TypeScript) — frontend + backend (API routes / server actions) en un solo proyecto.
- Postgres — persistencia (jerarquía empresa/proyecto/caso/ejecución, actas, credenciales, jobs).
- Prisma como ORM — migraciones versionadas y tipado end-to-end contra Postgres.
- Playwright instalado como dependencia del propio proyecto (no como servicio externo).
- Sin Redis ni colas externas: la concurrencia de ejecuciones se controla con una tabla de "jobs" en la misma Postgres (cola simple basada en estado + lock), suficiente para el volumen esperado (un usuario, ejecuciones no masivas en paralelo). Esto mantiene el stack tal como lo pediste: Next.js + Postgres, autocontenido.

**Por qué no puede ser 100% serverless:**
Playwright necesita un proceso Node persistente con los binarios de navegador instalados y sin límite estricto de tiempo de ejecución. Por eso el "motor de ejecución" corre como un **proceso worker de larga duración dentro del mismo contenedor de la app** (no como una function serverless), mientras Next.js atiende la web normalmente. Ambos comparten el mismo código y la misma base de datos.

**Separación de responsabilidades dentro del mismo proyecto:**
- `web`: Next.js sirviendo UI + API (crear empresas/proyectos/casos, consultar ejecuciones, generar actas).
- `worker`: proceso Node (arrancado dentro del mismo contenedor en prod, o como script aparte en dev) que:
  1. Revisa la tabla `ejecucion` en estado `pendiente`.
  2. Levanta un proceso hijo (`child_process`) que corre `npx playwright test <archivo-del-caso>`.
  3. Captura resultado paso a paso, video, capturas y trace.
  4. Calcula hash sha256 de los artefactos.
  5. Actualiza la ejecución en Postgres y dispara la generación del acta.

  Dentro del paso 3, el worker usa un **reporter custom** además del JSON reporter: este reporter emite cada paso terminado (vía WebSocket o canal equivalente) al backend mientras la prueba corre, para que la UI muestre el detalle en el mismo instante en que el paso termina — sin esperar al cierre de toda la ejecución. Tras la ejecución, los artefactos que el runner dejó en su `outputDir` se **mueven al volumen persistente** de la plataforma, se calculan sus hashes sha256 y se registran sus rutas finales en la tabla `artefacto` (el `outputDir` temporal del worker no se conserva entre ejecuciones).

## 2. Modelo de datos (alto nivel)

- `usuario` (id, email, password_hash, rol) — hoy un solo registro superusuario, pensado para crecer.
- `espacio` (empresa) (id, nombre, color, activo).
- `usuario_espacio` (tabla puente, hoy trivial: el único usuario tiene acceso a todos; deja la puerta abierta a permisos por espacio).
- `proyecto` (id, espacio_id, nombre, ambiente, descripción).
- `caso_prueba` (id, proyecto_id, código REQ, nombre, ruta/referencia al endpoint o script de Playwright, responsable, activo).
- `ejecucion` (id, caso_prueba_id, estado [pendiente/corriendo/pasó/falló/reparado], inicio, fin, duración, log de pasos).
- `paso_ejecucion` (id, ejecucion_id, número, descripción, estado, duración, si hubo self-healing).
- `artefacto` (id, ejecucion_id, tipo [video/captura/trace], ruta en disco, hash sha256).
- `acta` (id, ejecucion_id, número/consecutivo, metadatos de firma, ruta del documento generado). Relación 1-a-1 con `ejecucion`: una ejecución produce un acta, y el acta se puede regenerar desde su ejecución conservando el mismo identificador.
- `credencial` (id, proyecto_id, nombre, tipo, valor cifrado) — prioridad baja, se implementa al final.

## 3. Fases de implementación

### Fase 0 — Fundamentos (sin código de producto todavía)
- Definir y congelar el modelo de datos anterior (diagrama + migraciones iniciales de Prisma).
- Definir convención para "cargar el caso mediante el endpoint": cómo se sube/registra el archivo `.spec.ts` de Playwright (subida de archivo vs. referencia a una ruta en un volumen) y dónde vive físicamente.
- Definir estructura de carpetas del proyecto (web + worker + carpeta de casos + carpeta de artefactos).
- **Entregable:** repositorio inicial, esquema de Prisma, documento de convenciones.

### Fase 1 — Esqueleto del proyecto y Docker de desarrollo
- Proyecto Next.js (TypeScript, App Router) con Prisma conectado a Postgres.
- `docker-compose.dev.yml` que **solo levanta Postgres** (con volumen persistente); la app corre local con `npm run dev` apuntando a esa base de datos vía `DATABASE_URL`.
- Instalación de Playwright y sus navegadores en el entorno de desarrollo (`npx playwright install --with-deps`).
- Autenticación mínima: login del usuario único (sesión con cookie firmada; sin lógica de roles todavía, pero con la tabla `usuario` ya lista para más).
- **Entregable:** app corriendo en local contra Postgres en Docker, login funcional, esqueleto de navegación (sidebar por espacios, como en el mockup pero sin datos reales).

### Fase 2 — Jerarquía empresa → proyecto → caso de prueba
- CRUD de espacios (empresas).
- CRUD de proyectos dentro de un espacio.
- CRUD de casos de prueba dentro de un proyecto, incluyendo la carga del script/endpoint de Playwright asociado.
- Listados y navegación equivalentes a las vistas "Proyectos" y "Casos de prueba" del mockup, pero con datos reales persistidos en Postgres.
- **Editor visual — fuera del MVP:** la vista "Editor" del mockup (pantalla 3) queda explícitamente fuera del MVP. La edición del caso se hace directamente sobre el archivo `.spec.ts` registrado en el proyecto, no en una UI visual. Los conceptos de "parámetros `{{param}}`" y "juego de datos CSV" que esa vista mostraba son aspiracionales y se retomarán en una fase posterior si el negocio lo pide.
- **Entregable:** se puede crear una empresa, un proyecto y registrar un caso de prueba apuntando a un script Playwright real, sin todavía ejecutarlo.

### Fase 3 — Motor de ejecución (la parte crítica)
- Implementar el worker: proceso Node separado dentro del mismo proyecto que:
  - Toma una ejecución en estado `pendiente`.
  - Ejecuta `playwright test` sobre el script del caso, en modo headless.
  - Parsea el reporter de Playwright (JSON reporter) para extraer pasos, duración y resultado.
  - Guarda video, capturas y trace en disco (volumen), calcula hash sha256.
- Endpoint/acción en la web para "disparar ejecución" desde la UI, que solo inserta el registro `pendiente` (el worker lo recoge; no se ejecuta síncronamente en el request HTTP).
- Manejo de concurrencia simple: un lock en Postgres para no correr dos ejecuciones del mismo caso a la vez (ampliable a más paralelismo después).
- **Entregable:** desde la web se dispara una ejecución real de un caso de prueba y el resultado (pasos, éxito/fallo, artefactos) queda en Postgres.

### Fase 4 — Vista de ejecución y evidencia
- Vista de detalle de ejecución: estado, pasos con su resultado, duración, marcador de self-healing si aplica.
- Reproducción de video/capturas y descarga de trace directamente desde la web (sirviendo los archivos del volumen).
- **Entregable:** vista de ejecución equivalente a la vista "Ejecución" del mockup, con datos y artefactos reales.

### Fase 5 — Acta de evidencia
- Generación automática del acta al finalizar cada ejecución: documento con metadatos (ID de ejecución, caso, REQ, ambiente, fechas, ejecutor), resultado por paso y hashes de los artefactos.
- Vista del acta en la web (equivalente a la vista "Acta de evidencia" del mockup) y exportación a PDF.
- **Entregable:** cada ejecución produce un acta consultable y descargable.

### Fase 6 — Extensibilidad de usuarios (sin implementarla del todo, pero dejarla lista)
- Confirmar que el modelo de permisos por espacio (`usuario_espacio`) soporta agregar usuarios sin cambios estructurales.
- Documentar cómo se activaría en el futuro (no se construye la UI de gestión de usuarios todavía, solo se valida que el diseño no lo bloquea).

### Fase 7 — Credenciales (prioridad baja)
- CRUD simple de credenciales por proyecto, valor cifrado en base de datos, nunca expuesto en texto plano en la UI ni en el acta.
- **Entregable:** vista de credenciales equivalente a la del mockup, sin mostrar contraseñas.

### Fase 8 — Docker de producción y despliegue
- `Dockerfile` de producción: build de Next.js en modo `standalone` + instalación de Playwright y sus navegadores en la misma imagen. Dos opciones viables para la imagen base:
  1. **Imagen oficial** `mcr.microsoft.com/playwright:vX-noble` como `FROM` — ya trae los binarios de los navegadores y todas las dependencias de sistema; build más rápido y reproducible.
  2. **`FROM node:20-bookworm`** + `RUN npx playwright install --with-deps chromium` dentro del Dockerfile — más control sobre versiones, build potencialmente más pequeño tras prune.
  Queda explícitamente descartado el uso de **Alpine** como base: Playwright requiere glibc y los builds de Firefox/WebKit no compilan en musl.
- `docker-compose.prod.yml`: contenedor de la app (web + worker corriendo juntos, o dos servicios del mismo build si conviene separarlos para reiniciar independientemente) **sin** Postgres incluido — la base de datos en producción vive aparte (instancia propia, gestionada o en su propio servidor), y la app se conecta por `DATABASE_URL` a esa instancia externa.
- Volumen persistente para artefactos (videos/capturas/trace/actas) montado en el contenedor de producción.
- Variables de entorno y secretos (conexión a base de datos, secreto de sesión, clave de cifrado de credenciales) fuera de la imagen.
- **Entregable:** imagen de producción reproducible, `docker-compose.prod.yml` que asume una Postgres externa, documentación de despliegue.

### Fase 9 — Endurecimiento y observabilidad (posterior al MVP)
- Backups de la base de datos y del volumen de artefactos.
- Logs estructurados del worker (para depurar ejecuciones fallidas del propio motor, no solo de las pruebas).
- Límite de retención de artefactos si el volumen crece demasiado.
- Ajustes de concurrencia del worker si el volumen de ejecuciones aumenta.

**Política de retención (aspiracional):**
El bloque de integridad con sha256 y el periodo de retención a 5 años que aparece en el mockup del acta es una **propuesta a confirmar con el oficial de cumplimiento** antes de fijarla. Queda como elemento de esta fase (cuando se active), no del MVP. Hasta entonces, el volumen de artefactos se trata según HU-8.3 sin política formal de retención ni de inmutabilidad.

## 4. Docker: resumen dev vs. prod

| | Desarrollo | Producción |
|---|---|---|
| Postgres | Contenedor único en `docker-compose.dev.yml`, con volumen local | Instancia separada (no vive en el mismo compose de la app) |
| App (web+worker) | Corre local con `npm run dev`, sin contenedor propio | Contenedor propio, build `standalone`, con Playwright y navegadores instalados en la imagen |
| Artefactos (video/capturas/trace) | Carpeta local del proyecto | Volumen persistente montado en el contenedor |
| Justo lo mínimo en Docker | Solo la base de datos | App + volumen; la base de datos se conecta como servicio externo |

## 5. Orden recomendado de trabajo

Fases 0 → 1 → 2 → 3 son secuenciales y son el corazón del MVP (sin esto no hay producto). La Fase 4 y 5 dependen directamente de la 3. La Fase 6 es solo validación de diseño, no bloquea nada. Fase 7 (credenciales) se puede mover a cualquier punto después de la Fase 2 sin dependencias fuertes. Fase 8 se hace en paralelo desde que existe algo desplegable (se puede empezar a probar Docker de producción desde el final de la Fase 3, sin esperar al final de todo).
