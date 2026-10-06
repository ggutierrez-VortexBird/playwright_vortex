# Auditoría de vorTest — 2026-10-06

Auditoría previa a la mejora integral de UI, UX, robustez y documentación.
Alcance: `vortest-web` (Next.js 16, React 19, Tailwind 3.4, Prisma 6, PostgreSQL,
iron-session) y `vortest-engine` (NestJS 12, Playwright 1.62, RabbitMQ).

## Metodología

- Recorrido de la app levantada con Playwright: 15 pantallas en escritorio (1440 px)
  y móvil (390 px), flujos de ejecución, grabación, evidencias y acta.
- Tres revisiones de código por área (UI y sistema de diseño, UX y accesibilidad,
  backend y seguridad), con los hallazgos graves **verificados en vivo** antes de
  incluirlos (marcados con ✔).
- Herramientas, estado inicial:

| Chequeo | vortest-web | vortest-engine |
|---|---|---|
| ESLint | 156 errores, 69 advertencias (40 errores en código de app, 116 en tests) | 2 errores, 5 advertencias |
| `tsc --noEmit` | 10 errores, todos en `__tests__` | 3 errores, todos en `*.spec.ts` |
| Build | OK; 1 advertencia: `middleware` deprecado en favor de `proxy` | OK |
| `npm run lint` | **roto**: Next 16 eliminó `next lint` | OK |

Restricción del proyecto: los tests no se modifican (`CLAUDE.md`: "Jamás arregles
test a menos de que te lo pida explícitamente"). Sus errores de lint/typecheck se
reportan aparte.

Severidades: **C** crítica · **A** alta · **M** media · **B** baja.
Estado: ⏳ pendiente · ✅ resuelto · ➖ no se resuelve (con motivo).

---

## Seguridad

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| SEG-01 | C | ✔ El script de cada caso corre con **todo** el entorno del motor: `RABBITMQ_URL` con credenciales, `ENGINE_INTERNAL_SECRET`. Un script puede leerlos y, con el secreto, sobrescribir evidencias de cualquier ejecución. | `vortest-engine/src/execution/runner.ts:452` (`...process.env`) | Lista blanca de variables para el proceso hijo. Red de Docker separada: el motor no alcanza Postgres. | ⏳ |
| SEG-02 | A | ✔ El listado de ejecuciones envía al navegador el `storageState` (cookies del sitio bajo prueba) y el `script` completo de los casos: 1,47 MB de HTML. | `lib/ejecuciones/queries.ts:67` (`findMany` sin `select`) → `EjecucionesList` (`'use client'`) | `select` explícito en listados; `storageState` nunca sale del servidor. | ⏳ |
| SEG-03 | A | ✔ El límite de intentos de login usa `x-forwarded-for`, que controla el cliente: cambiándolo, intentos ilimitados. | `app/login/actions.ts:34` | Clave por email normalizado + IP sólo de un proxy de confianza; contador atómico. | ⏳ |
| SEG-04 | A | ✔ Redirección abierta en el login: `from=/\evil.com` pasa la validación. | `app/login/actions.ts:83` | Validar con `new URL(from, origen)` y exigir mismo origen. | ⏳ |
| SEG-05 | A | ✔ Un admin puede suspender a cualquier tester, también de espacios que no administra. | `lib/usuarios/actions.ts:182` | Exigir que el tester pertenezca a un proyecto de un espacio del admin. | ⏳ |
| SEG-06 | M | Lo tecleado en el caso (incluidas contraseñas) queda en texto plano en los pasos, la pantalla y el Acta: `Fill "secret_sauce" locator('#password')`. | `vortest-engine/scripts/my-reporter.js` (`step.title`) | Enmascarar el valor de `fill`/`pressSequentially` sobre campos sensibles. | ⏳ |
| SEG-07 | M | Errores técnicos llegan al cliente: mensajes de Prisma, de Chromium, rutas del servidor (`pdfPath`, `rutaPdf`). | `descartar/route.ts:49`, `acta/route.ts:144,171`, `ejecuciones/[id]/route.ts:103` | Mensaje genérico al cliente; detalle sólo en el log. | ⏳ |
| SEG-08 | M | `CREDENCIALES_ENCRYPTION_KEY` no está en ningún `.env.example`; se cae a una clave derivada de `SESSION_SECRET`, la misma de las cookies. | `lib/credenciales/crypto.ts:29,58` | Documentarla y exigirla; cachear la clave derivada. | ⏳ |
| SEG-09 | B | Cabeceras: CSP sólo en modo reporte, sin HSTS, `X-Powered-By` expuesto. | `next.config.ts` | `poweredByHeader: false`; CSP sin la fuente externa de Google. | ⏳ |
| SEG-10 | B | `wsUrl` del grabador se acepta desde el querystring sin validar. | `casos/grabar/[sesionId]/page.tsx:73` | Validar que apunte al recorder configurado. | ⏳ |

## Bugs

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| BUG-01 | A | ✔ El mismo caso se puede ejecutar dos veces en paralelo: dos `POST /ejecutar` seguidos devuelven 201 y 201. El guard ignora el resultado del `SELECT … FOR UPDATE NOWAIT`. | `lib/ejecuciones/actions.ts:42` | Índice único parcial `(casoPruebaId) WHERE estado IN ('pendiente','corriendo')` → 409. | ⏳ |
| BUG-02 | A | ✔ Las evidencias de más de 10 MB se pierden: el middleware corta el cuerpo en 10 MB y la subida responde `400 invalid_multipart`. | `middleware.ts` (matcher incluye `/api/internal`) | Excluir `/api/internal` del matcher; validar `sha256` y `bytes`. | ⏳ |
| BUG-03 | A | ✔ 9 de 16 migraciones no están en git (incluida la inicial): un clon limpio no puede crear la base. Una tiene fecha 2025 y ordena antes de `init`. | `.gitignore:18`, `prisma/migrations/` | Versionar todas las migraciones. | ⏳ |
| BUG-04 | A | En la revisión del grabador, el botón "Guardar como caso" del encabezado es un enlace a la misma página: recarga y descarta lo editado. | `casos/grabar/[sesionId]/revisar/page.tsx:72` | Quitarlo (el guardado real está en el cuerpo). | ⏳ |
| BUG-05 | A | El motor confirma el job al lanzarlo, no al terminarlo: la concurrencia no está limitada y si el motor cae, el job se pierde. | `execute-job.consumer.ts:191`, `execution.service.ts:276` | Confirmar al terminar (prefetch real). | ⏳ |
| BUG-06 | M | El polling del detalle de ejecución nunca se detiene (cada 2 s, para siempre); ignora errores y no detecta sesión vencida. | `ejecucion-detalle-client.tsx:190` | Parar en estado terminal, pausar con la pestaña oculta, reintento con espera y aviso de conexión perdida. | ⏳ |
| BUG-07 | M | El watchdog pisa un `end` recién llegado (sin condición de estado). | `scripts/execution-consumer.ts:397` | `updateMany` condicionado a `corriendo`. | ⏳ |
| BUG-08 | M | Mensajes envenenados: `nack(requeue)` sin límite en `engine.events` bloquea la cola; un `end` repetido despacha el hijo dos veces. | `lib/queue/rabbitmq.ts:205`, `execution-consumer.ts:216` | Límite de reintentos; despacho del hijo atómico (CAS sobre `pendingChildEjecucionId`). | ⏳ |
| BUG-09 | M | En POSIX, cancelar mata sólo el proceso principal: pueden quedar navegadores huérfanos. | `kill-tree.ts:36`, `runner.ts:468` | `detached: true` y `process.kill(-pid)`. | ⏳ |
| BUG-10 | M | Artefactos con el mismo nombre se pisan (`video.webm` de varios tests). | `artifacts.service.ts:198`, `upload/route.ts:119` | Nombre único por artefacto. | ⏳ |
| BUG-11 | M | Doble clic en "Ejecutar": el botón se rehabilita antes de navegar. | `caso-table.tsx:215`, `caso-detalle-cliente.tsx:173` | No resetear en éxito, `router.push`, guard por ref. | ⏳ |
| BUG-12 | M | Validación de entrada: casi ninguna ruta usa zod; `request.json()` fuera de `try` (cuerpo malformado → 500); `?estado=foo` rompe `/ejecuciones`. | 10+ rutas en `app/api/**`, `queries.ts:63` | Helper `parseBody(request, schema)` con zod → 400. | ⏳ |
| BUG-13 | M | Quedan rutas que convierten `FORBIDDEN` en 500. | `proyectos/[id]/route.ts:59,82`, `espacios/[id]/route.ts:40,64,88`, `parametros/[paramId]:74` | `mapErrorToResponse`. | ⏳ |
| BUG-14 | M | Borrar un espacio o proyecto que falla no muestra nada. | `espacios-client.tsx:491`, `proyecto-grid.tsx:76` | Mostrar el error con causa y conteos. | ⏳ |
| BUG-15 | M | KPIs del inicio calculados sobre 20 filas paginadas, no sobre el total. | `(dashboard)/page.tsx:34` | `count`/`groupBy`. | ⏳ |
| BUG-16 | M | Carreras: dos "Guardar" del grabador crean dos casos; dos "Generar acta" gastan dos consecutivos. | `guardar/route.ts:113`, `acta/route.ts:113` | Condición de estado dentro de la transacción. | ⏳ |
| BUG-17 | B | `layout.tsx` del dashboard lee `params.id`, que nunca existe: la franja de color del espacio nunca se pinta. | `(dashboard)/layout.tsx:38` | Quitar el código muerto. | ⏳ |
| BUG-18 | B | Perfil: el diálogo de "cambios sin guardar" es inalcanzable. | `perfil-client.tsx:56` | Conectar o quitar. | ⏳ |

## Rendimiento

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| REN-01 | A | N+1: métricas de cada proyecto en bucle, cada una cargando todas sus ejecuciones (con `storageState`). | `proyectos/actions.ts:167`, llamada desde 3 lugares | Una consulta agregada por lote. | ⏳ |
| REN-02 | A | Fuentes: `@import` de Google Fonts que bloquea el render, 6 familias, Inter duplicada. | `globals.css:1`, `layout.tsx` | Sólo `next/font` (Archivo + JetBrains Mono). | ⏳ |
| REN-03 | M | Índices faltantes (`Ejecucion` por caso+fecha, por fecha, por estado; `PasoSubaccion` por paso+número) y redundantes. | `prisma/schema.prisma` | Migración de índices. | ⏳ |
| REN-04 | M | `getCasoById` trae todas las ejecuciones sin límite; `listCasos` sin paginación. | `casos/actions.ts:226` | `take` y `select`. | ⏳ |
| REN-05 | B | `lib/utils.ts` importa `tailwind.config` en el bundle del cliente. | `lib/utils.ts:3` | Lista estática. | ⏳ |

## UI

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| UI-01 | A | La marca no está en la interfaz: el logo es teal ("vor") y ámbar ("Test"), pero el primario es **azul** (`#2F5FBD`) en botones, títulos y enlaces. | `tailwind.config.ts:33`, capturas | Paleta de marca medida del logo: teal `#135C65`, ámbar `#EEAA0B`. | ⏳ |
| UI-02 | A | Tokens duplicados: los colores están en hex en `tailwind.config.ts` y repetidos en `globals.css`. Dos sistemas de color en paralelo (legacy sin uso + M3). | `tailwind.config.ts:13-97`, `globals.css:294` | Una sola fuente: variables CSS consumidas por Tailwind. | ⏳ |
| UI-03 | A | Clases que no existen y Tailwind ignora sin avisar: `m3-warning`, `on-success-container`, `text-label-xs` (14 usos), `text-display-md`, `text-body-xs`. | `execution-timeline.tsx`, `kpi-tile.tsx`, `ejecuciones-list.tsx` | Definir los tokens que faltan. | ⏳ |
| UI-04 | A | El mismo resultado tiene cinco nombres en una pantalla ("Falló", "No conforme (paso 1)", "Falló en el paso 1", "No conforme", "Fallo · verificación"); hay mapas de estado paralelos y textos en inglés (`Passed/Failed`). | `estado.ts:12`, `caso-table.tsx:38`, `ejecuciones/page.tsx:98` | Un único mapa estado → etiqueta + tono + ícono. Vocabulario "Conforme / No conforme". | ⏳ |
| UI-05 | A | Badges de estado sólo con color y texto, sin ícono; barras y filas sólo con color. | `status-badge.tsx`, `video-chapter-bar.tsx`, `paso-accordion-item.tsx` | `StatusBadge` con ícono obligatorio. | ⏳ |
| UI-06 | A | Faltan componentes base: `Input`/`Select`/`Textarea`/`Field` (~25 copias), `Toast`, `Spinner` (5 implementaciones), `Card` (~72 a mano), `Tabs`, `Breadcrumbs`, `Icon`. `Button` sin estado de carga; 70 `<button>` crudos. | `components/ui/` | Crear y unificar. | ⏳ |
| UI-07 | M | Valores mágicos: 34 hex en `.tsx`, paleta Tailwind por defecto en 13 archivos, 55 tamaños de texto arbitrarios (51 de 11 px o menos), z-index sin escala. | `caso-detalle-cliente.tsx:280`, `usuarios-client.tsx:420` | Tokens de color, tipografía y z-index. | ⏳ |
| UI-08 | M | La 404 sale de la estética: fondo y texto con **degradados**, botón "Volver al dashboard". | `app/not-found.tsx:9,17` | Rediseño sólido, dentro del lenguaje de la app. | ⏳ |
| UI-09 | M | Botones del encabezado del detalle con estilos distintos; en móvil se parten en dos líneas. | `re-run-button.tsx`, `generar-acta-button.tsx` | `Button` común; acciones en barra adaptable. | ⏳ |
| UI-10 | B | Sin modo oscuro. | — | Variables por tema + `prefers-color-scheme` + selector manual. | ⏳ |
| UI-11 | B | Íconos de Material Symbols por `<link>`: sin `aria-hidden` en 100 de 109; si la fuente tarda se leen "play_arrow", "add". | `layout.tsx:54` | Componente `Icon` con `aria-hidden`. | ⏳ |

## UX

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| UX-01 | A | Los `error.tsx` muestran `error.message`, que en producción es un texto genérico en inglés. No existen `global-error.tsx` ni frontera de error en el inicio. | 10 `error.tsx` | Texto en español + código de soporte + reintentar. | ⏳ |
| UX-02 | A | Ejecución: sin tiempo transcurrido, sin aviso al terminar, sin toast; el estado "Corriendo" se duplica. | `ejecucion-summary.tsx:68` | Cronómetro en vivo y aviso al finalizar (toast + región `aria-live`). | ⏳ |
| UX-03 | A | "Detener" usa `window.confirm` nativo; "Volver a ejecutar" muestra códigos internos (`YA_EXISTE_EJECUCION_EN_CURSO`). | `detener-button.tsx:33`, `re-run-button.tsx:25` | `ConfirmDialog` y mensajes en español. | ⏳ |
| UX-04 | A | Evidencias: capturas recortadas (16:9 con `object-cover`), sin visor ni zoom; artefactos rotulados con tipos crudos. | `paso-subaccion-item.tsx:196` | Visor con `object-contain`, teclado y descarga. | ⏳ |
| UX-05 | A | Listado de ejecuciones: un buscador por grupo, búsqueda sin espera entre teclas, búsqueda vacía sin salida, filtro de estado sin interfaz, totales sólo de la página, "omitido" para estados que no lo son. | `ejecuciones-list.tsx:229`, `ejecuciones/page.tsx:43` | Un buscador y filtro de estado en el encabezado, totales reales. | ⏳ |
| UX-06 | M | Sin títulos de página: todas las pestañas dicen "VorTest". | todas las rutas | `metadata` y `generateMetadata` por ruta. | ⏳ |
| UX-07 | M | Migas de pan derivadas del menú: no muestran espacio → proyecto → caso → ejecución, recargan la página completa (`<a>` en lugar de `Link`). | `scope-bar-with-context.tsx:25` | Migas jerárquicas reales con `Link`. | ⏳ |
| UX-08 | M | Formularios: validación nativa, un único mensaje al final, sin foco al primer error; Esc o clic afuera cierran el modal y pierden lo escrito. | `create-caso-form.tsx:36`, `modal.tsx:27` | `Field` con error en línea, foco al primero, confirmación si hay cambios. | ⏳ |
| UX-09 | M | Grabador: barra de navegación simulada con un botón "Ir" que no hace nada; descartar ignora fallos; sin pasos en vivo, sólo contadores. | `browser-chrome.tsx:296`, `grabador-client.tsx:186` | Quitar lo simulado; lista de pasos en vivo; errores visibles. | ⏳ |
| UX-10 | M | Listados sin ordenamiento; `/casos` sin columna de proyecto; estados vacíos sin llamada a la acción. | `caso-table.tsx:88`, `proyectos-client.tsx:187` | Columna Proyecto, orden y CTA. | ⏳ |
| UX-11 | M | Feedback de éxito inconsistente: sólo Espacios tiene un aviso. | `espacios-client.tsx:555` | Toasts en todas las acciones. | ⏳ |
| UX-12 | M | Credenciales: página "PRÓXIMAMENTE" con botones deshabilitados en el menú principal. | `credenciales/page.tsx:21` | Gestión básica (crear, listar, eliminar). | ⏳ |
| UX-13 | M | Textos: inglés suelto ("Failed to fetch proyectos", "Live", "Unknown error"), voseo mezclado con tuteo, códigos HTTP visibles ("Error 500"), jerga ("recorder-worker", "headed"). | varios | Revisión de textos. | ⏳ |
| UX-14 | B | `loading.tsx` heredados equivocados: el detalle de ejecución muestra el esqueleto del listado. | `ejecuciones/[id]` | `loading.tsx` propios. | ⏳ |

## Accesibilidad

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| A11Y-01 | A | Contraste bajo 4.5:1: menú lateral inactivo 3.4, "Conforme" 3.8, texto blanco sobre el color por defecto de espacio 3.1, foco sobre el menú 2.6. | `sidebar-nav.tsx:120`, `globals.css:44` | Tokens con contraste ≥ 4.5:1; texto según luminancia del color de usuario. | ⏳ |
| A11Y-02 | A | Campos sin nombre accesible en usuarios, testers, admins y selector de color; `htmlFor` huérfanos en los formularios de casos. | `usuarios-client.tsx:204` | `Field` con `id`/`htmlFor`. | ⏳ |
| A11Y-03 | A | Foco invisible en el input de archivo y en las opciones de navegador del grabador. | `script-file-input.tsx:49` | `focus-visible` en el elemento visible. | ⏳ |
| A11Y-04 | M | Menú de usuario, selectores y cajón móvil sin Escape, sin roles correctos ni manejo de foco; sin "saltar al contenido". | `user-menu.tsx`, `responsive-sidebar-shell.tsx` | Roles y teclado; skip-link. | ⏳ |
| A11Y-05 | M | Filas clicables sin teclado (`<tr onClick>`); botones-ícono repetidos sin el nombre del ítem. | `caso-table.tsx:316` | Enlaces reales; `aria-label` con el nombre. | ⏳ |
| A11Y-06 | B | Gráficos sin alternativa textual; tres estados comparten color. | `(dashboard)/page.tsx:22` | Resumen textual y colores distintos. | ⏳ |

## Código y deuda técnica

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| COD-01 | A | `npm run lint` roto (`next lint` no existe en Next 16); `eslint-config-next` en 15.x. | `package.json` | `eslint .` y alinear versiones. | ⏳ |
| COD-02 | M | 40 errores de lint en código de la app (`any`, `require`). | `lint` | Tipar con `unknown`. | ⏳ |
| COD-03 | M | Código muerto: `lib/worker/{claim,lock,kill-tree,log-cap,storage-state,validate-script}`, `auto-repair`, `reparados-counter`, `ejecutar-button`, `acta-header`, `execution-status-bar`, `execution-timeline`, `scope-bar`, `dom-utils`, copia del reporter en web, tokens y CSS sin uso; restos de la auto-reparación (`reparado`). | varios | Eliminar (los que sólo usan tests se reportan, no se borran tests). | ⏳ |
| COD-04 | M | Dependencias sin uso: `@dnd-kit/*`, `ts-jest` (web); `joi`, `@standard-schema/spec`, `@nestjs/testing` y otras (engine). `playwright` usado sin declarar en web. | `package.json` | Limpiar y declarar. | ⏳ |
| COD-05 | B | `middleware.ts` deprecado en Next 16. | build | Renombrar a `proxy.ts`. | ⏳ |
| COD-06 | B | Navegación interna con `<a>` y `window.location.href` (recarga completa). | `sidebar-nav.tsx:41` | `Link` / `router.push`. | ⏳ |

## Documentación

| ID | Sev | Hallazgo | Evidencia | Solución | Estado |
|---|---|---|---|---|---|
| DOC-01 | A | La documentación de `documentacion/` es anterior al split y describe el monolito. No hay `docs/` en el repo del código. | `documentacion/*.md` (2026-09-14) | `docs/` con arquitectura, modelo de datos, API, sistema de diseño y contribución. | ⏳ |
| DOC-02 | M | `.env.example` incompletos: faltan `CREDENCIALES_ENCRYPTION_KEY`, `PLAYWRIGHT_LOCALE`, `PLAYWRIGHT_TIMEZONE`; sobran variables que nadie lee. | `.env.example` | Alinear con el código. | ⏳ |
| DOC-03 | M | `vortest-web/CLAUDE.md` afirma cosas falsas (archivos "borrados" que existen, auto-reparación inyectada). | `vortest-web/CLAUDE.md` | Corregir. | ⏳ |
| DOC-04 | B | Sin `CHANGELOG.md` en el repo del código. | — | Crearlo. | ⏳ |

---

## Plan de trabajo (orden de ejecución)

1. **Seguridad y bugs de datos**: SEG-01..05, BUG-01..03, BUG-05, SEG-06.
2. **Fundaciones de UI**: UI-01, UI-02, UI-03, UI-07, REN-02, UI-11, UI-10.
3. **Componentes base**: UI-06, UI-05, UI-04.
4. **UX de flujos**: BUG-04, BUG-06, BUG-11, UX-01..05, UX-09, UX-04.
5. **Navegación, formularios y listados**: UX-06..08, UX-10, UX-11, UX-13, UX-14, UX-12, UI-08, UI-09.
6. **Accesibilidad**: A11Y-01..06.
7. **Robustez y código**: BUG-07..10, BUG-12..18, REN-01, REN-03..05, SEG-07..10, COD-01..06.
8. **Documentación**: DOC-01..04.
9. **Verificación final** y actualización de esta tabla.
