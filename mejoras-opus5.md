# Plan de mejoras — vorTest (`playwright_vortex`)

> **Auditoría de solo lectura.** Este documento es el diagnóstico y el plan de acción; no se modificó ningún archivo del proyecto para producirlo.
> **Fuera de alcance:** archivos de tests y su configuración (`__tests__/`, `*.test.ts`, `*.spec.ts`, `e2e/`, `jest.*`, `__mocks__/`) — se abordarán en una fase posterior.
>
> **Alcance:** `vortest-web/` (Next.js 15 + Prisma + Postgres), `vortest-engine/` (NestJS, motor de Playwright), y la raíz del repositorio (Docker Compose, CI, configuración compartida). Rama `feature/separacion-monolito`.
>
> **Metodología:** cuatro auditorías independientes en paralelo (seguridad y backend · motor, cola y Playwright · frontend y estructura · dependencias, infraestructura y logging), tomando como línea base la versión anterior de este documento y re-verificando cada hallazgo contra el código actual. Los hallazgos de prioridad alta se verificaron además directamente contra el código fuente; se marcan con **✔**. Donde algo no pudo confirmarse sin ejecutar el sistema, se indica como *sospecha*.

---

## Índice

0. [Estado del repositorio — leer antes que nada](#0-estado-del-repositorio--leer-antes-que-nada)
1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Seguridad](#2-seguridad)
3. [Fiabilidad del motor y la cola](#3-fiabilidad-del-motor-y-la-cola)
4. [Configuración y uso de Playwright](#4-configuración-y-uso-de-playwright)
5. [Rendimiento](#5-rendimiento)
6. [Manejo de errores y casos límite](#6-manejo-de-errores-y-casos-límite)
7. [Estructura, arquitectura y organización](#7-estructura-arquitectura-y-organización)
8. [Código duplicado y patrones inconsistentes](#8-código-duplicado-y-patrones-inconsistentes)
9. [Convenciones de nombres y estilo](#9-convenciones-de-nombres-y-estilo)
10. [Frontend, UX y accesibilidad](#10-frontend-ux-y-accesibilidad)
11. [Dependencias](#11-dependencias)
12. [Configuración, variables de entorno y secretos](#12-configuración-variables-de-entorno-y-secretos)
13. [Docker e infraestructura](#13-docker-e-infraestructura)
14. [Logging y trazabilidad](#14-logging-y-trazabilidad)
15. [Documentación](#15-documentación)
16. [Plan de ejecución sugerido](#16-plan-de-ejecución-sugerido)
17. [Ya resuelto en el árbol de trabajo](#17-ya-resuelto-en-el-árbol-de-trabajo)
18. [Lo que está bien hecho](#18-lo-que-está-bien-hecho)

---

## 0. Estado del repositorio — leer antes que nada

Esto no es un hallazgo del código sino del estado del árbol de trabajo, y condiciona todo lo demás.

**Hay trabajo importante que existe solo en disco, sin versionar.** Verificado con `git ls-files`: **`vortest-engine/` tiene 0 archivos en el índice de git** — el motor completo (la pieza central de la separación del monolito) es un directorio sin rastrear. Lo mismo ocurre con `vortest-web/lib/queue/`, `vortest-web/app/api/internal/`, `.github/`, `Makefile`, `rabbitmq/` y otros. Si ese disco falla, o alguien ejecuta un `git clean`, todo eso se pierde sin historial.

**Hay correcciones aplicadas a medias y nunca verificadas.** Un intento anterior de aplicar la versión previa de este plan se interrumpió a mitad. Resultado, evaluado pieza por pieza:

- **Bien resuelto** (ver [§17](#17-ya-resuelto-en-el-árbol-de-trabajo)): alineación de versión de Playwright, `.dockerignore` del motor, secretos obligatorios en el compose, credenciales de RabbitMQ, `tini`, usuarios no-root, multi-stage del motor, ESLint, CI, Dependabot, README. Nada de lo revisado está roto.
- **Quedó a medias, y conviene saberlo porque parece resuelto y no lo está:**
  - `amqp-connection-manager` está en `package.json` **pero el código no lo usa** → el bug de reconexión a RabbitMQ sigue intacto ([FIA-04](#fia-04)).
  - `vortest-web/lib/env.ts` existe y está bien escrito **pero nadie lo importa** → la validación de entorno no tiene efecto ([CFG-01](#cfg-01)).
  - La dead-letter queue está declarada en `rabbitmq/definitions.json` **pero la cola real no está enlazada a ella** ([FIA-10](#fia-10)).
  - Los encabezados de "ARCHIVADO" se pusieron en 6 documentos de `sdd/` **pero no en `openspec/`**, que es la mayor parte ([DOC-02](#doc-02)).

> **Recomendación previa a cualquier otra cosa:** decidir qué se versiona de ese árbol de trabajo y consolidarlo, para que el plan de abajo se ejecute sobre una base con historial. (Este documento no hace commits; es decisión del equipo.)

---

## 1. Resumen ejecutivo

**101 hallazgos vigentes: 18 de prioridad alta, 45 media, 38 baja.** Además, 22 hallazgos de la versión anterior ya están resueltos en el árbol de trabajo ([§17](#17-ya-resuelto-en-el-árbol-de-trabajo)).

**Lectura general.** La arquitectura es sólida: el RBAC está bien centralizado, el esquema de datos tiene criterio, y el motor está bien modularizado. Los problemas graves no son de diseño sino de tres tipos:

1. **Aplicación inconsistente de patrones que el propio equipo definió bien.** Los 3 IDOR son 4 endpoints que olvidaron llamar a un guard que el resto de los 33 sí llama.
2. **Huecos operativos que dejó la separación del monolito.** El motor se extrajo correctamente, pero sin límite de concurrencia, sin red de seguridad para ejecuciones colgadas, y sin reconexión del lado web.
3. **Capacidades anunciadas que no funcionan.** La auto-reparación de selectores nunca se conectó, el multi-navegador solo existe en la grabación, y los *traces* nunca se generan. Ninguno es una regresión del refactor — estaban así en `develop`.

**Esfuerzo:** `S` < 1 h · `M` 1–4 h · `L` 1–2 días · `XL` > 2 días

### Prioridad alta (18)

| # | ID | Hallazgo | Categoría | Esf. |
|---|---|---|---|---|
| 1 | [SEG-01](#seg-01) | IDOR: cualquier usuario descarga el Acta (PDF) de cualquier cliente | Seguridad | S |
| 2 | [SEG-02](#seg-02) | IDOR de lectura **y escritura** en `juego-de-datos` y `parametros` de cualquier caso | Seguridad | S |
| 3 | [SEG-03](#seg-03) | Credenciales de cualquier proyecto listables por cualquier usuario autenticado | Seguridad | S |
| 4 | [SEG-04](#seg-04) | `next` 15.5.22 con dos RCE críticas no autenticadas (una específica de Windows) | Seguridad | S |
| 5 | [SEG-05](#seg-05) | Ausencia total de rate limiting (login incluido) | Seguridad | M |
| 6 | [FIA-01](#fia-01) | Bug: si falla el encolado del caso padre, la fila padre queda en `corriendo` para siempre | Fiabilidad | S |
| 7 | [FIA-02](#fia-02) | Prefetch ilimitado: N jobs encolados = N navegadores simultáneos → OOM | Fiabilidad | S |
| 8 | [FIA-03](#fia-03) | Sin watchdog: ejecuciones colgadas para siempre y caso de prueba bloqueado | Fiabilidad | M |
| 9 | [FIA-04](#fia-04) | `vortest-web` nunca se reconecta a RabbitMQ (la librería está instalada pero sin usar) | Fiabilidad | M |
| 10 | [FIA-05](#fia-05) | El directorio de salida de cada ejecución nunca se borra → el disco se llena | Fiabilidad | S |
| 11 | [PW-01](#pw-01) | Timeout de Playwright de 60 s contra un presupuesto de job de 10 min | Playwright | S |
| 12 | [PW-02](#pw-02) | `locale: 'es-CO'` con `timezoneId: 'Europe/Madrid'` — 6-7 h de desfase | Playwright | S |
| 13 | [PW-03](#pw-03) | La auto-reparación de selectores nunca se ejecuta; el contador "Reparados" mide otra cosa | Playwright | L |
| 14 | [PW-04](#pw-04) | Multi-navegador: se elige al grabar, pero la ejecución siempre usa Chromium | Playwright | M |
| 15 | [REN-01](#ren-01) | El poll de 2 s del detalle de ejecución nunca se detiene | Rendimiento | S |
| 16 | [REN-02](#ren-02) | Listados sin paginación en base: `/ejecuciones` trae la tabla completa | Rendimiento | L |
| 17 | [DEP-01](#dep-01) | 9 vulnerabilidades adicionales en `vortest-web`, todas arreglables sin salto de mayor | Dependencias | S |
| 18 | [INF-01](#inf-01) | Ningún contenedor tiene límites de CPU/memoria | Infraestructura | S |

### Prioridad media (45)

| # | ID | Hallazgo | Categoría | Esf. |
|---|---|---|---|---|
| 19 | [SEG-06](#seg-06) | Enumeración de usuarios en el login (mensajes y tiempos distintos) | Seguridad | S |
| 20 | [SEG-07](#seg-07) | Open redirect tras el login | Seguridad | S |
| 21 | [SEG-08](#seg-08) | `ejecucionId` sin validar en la subida interna de artefactos (path traversal) | Seguridad | S |
| 22 | [SEG-09](#seg-09) | Comparación de secretos internos no constante en tiempo (3 sitios) | Seguridad | S |
| 23 | [SEG-10](#seg-10) | El middleware excluye todo `/api` — sin defensa en profundidad | Seguridad | S |
| 24 | [SEG-11](#seg-11) | Sin cabeceras de seguridad HTTP (CSP, `X-Frame-Options`…) | Seguridad | M |
| 25 | [SEG-12](#seg-12) | `SESSION_SECRET` reutilizado como clave de cifrado de credenciales | Seguridad | M |
| 26 | [FIA-06](#fia-06) | Duplicación de jobs entre réplicas del motor | Fiabilidad | S |
| 27 | [FIA-07](#fia-07) | Cancelar antes de que el motor registre el job no tiene efecto | Fiabilidad | M |
| 28 | [FIA-08](#fia-08) | Sin apagado ordenado: los jobs en curso mueren sin reportar | Fiabilidad | M |
| 29 | [FIA-09](#fia-09) | Contrato de mensajes copiado a mano entre proyectos, sin validación | Fiabilidad | M |
| 30 | [FIA-10](#fia-10) | Mensajes "veneno" se reencolan infinitamente; la DLQ está a medias | Fiabilidad | M |
| 31 | [FIA-11](#fia-11) | Asociación de capturas a pasos no idempotente ante reentrega | Fiabilidad | M |
| 32 | [FIA-14](#fia-14) | El health check del motor no refleja si está conectado a RabbitMQ | Fiabilidad | S |
| 33 | [FIA-15](#fia-15) | El evento `end` es *fire-and-forget*: si se pierde, la ejecución queda colgada | Fiabilidad | M |
| 34 | [PW-05](#pw-05) | `trace` existe en el modelo pero nunca se genera ni se recolecta | Playwright | S |
| 35 | [PW-06](#pw-06) | Sin `actionTimeout` / `navigationTimeout` / `expect.timeout` | Playwright | S |
| 36 | [PW-07](#pw-07) | El lint de selectores frágiles cubre un solo patrón | Playwright | M |
| 37 | [PW-08](#pw-08) | El parser del reporter acepta cualquier JSON de stdout, incluido el del usuario | Playwright | S |
| 38 | [PW-09](#pw-09) | Fallos al guardar el `storageState` del padre se tragan en silencio | Playwright | S |
| 39 | [REN-03](#ren-03) | `requestAnimationFrame` perpetuo en la barra de capítulos del video | Rendimiento | S |
| 40 | [ERR-01](#err-01) | Dos convenciones de error conviviendo, con un parche para los tests | Errores | M |
| 41 | [ERR-02](#err-02) | Columnas `Json` sin validación de forma (`storageState`, `filas`, `logs`…) | Errores | M |
| 42 | [EST-01](#est-01) | Tres puntos de entrada distintos para disparar una ejecución | Estructura | L |
| 43 | [EST-02](#est-02) | `getCasoById` / `getProyectoById` dependen de que el llamador aplique el guard | Estructura | M |
| 44 | [EST-03](#est-03) | Archivos cliente de 600-700 líneas con 4-9 componentes embebidos | Estructura | M |
| 45 | [DUP-01](#dup-01) | `formatDuration` / `formatDate` reimplementados 11 veces, con resultados distintos | Duplicación | M |
| 46 | [DUP-02](#dup-02) | Mapeo estado→color/etiqueta en 4 lugares; "Pasó" vs. "Conforme" | Duplicación | M |
| 47 | [DUP-03](#dup-03) | Boilerplate de autenticación repetido en 15+ route handlers | Duplicación | M |
| 48 | [FE-01](#fe-01) | El `Modal` compartido no atrapa ni restaura el foco | Frontend | M |
| 49 | [FE-02](#fe-02) | `loading.tsx` / `error.tsx` faltan en 5 de 9 rutas | Frontend | M |
| 50 | [FE-03](#fe-03) | `alert()` / `confirm()` nativos en 10 lugares | Frontend | M |
| 51 | [DEP-02](#dep-02) | 23 vulnerabilidades en `vortest-engine`, casi todas requieren NestJS 12 | Dependencias | L |
| 52 | [DEP-03](#dep-03) | Versiones mayores desactualizadas (Next, Prisma, NestJS, Tailwind, TS) | Dependencias | XL |
| 53 | [DEP-05](#dep-05) | El CI no ejecuta `npm audit` | Dependencias | S |
| 54 | [CFG-01](#cfg-01) | `lib/env.ts` existe pero nadie lo importa: el entorno no se valida al arrancar | Configuración | M |
| 55 | [INF-02](#inf-02) | Sin configuración de producción; CI/CD solo cubre la primera etapa | Infraestructura | XL |
| 56 | [INF-03](#inf-03) | Puertos internos publicados; la cola de jobs permite ejecución de código | Infraestructura | S |
| 57 | [INF-04](#inf-04) | Secretos como variables de entorno en texto plano | Infraestructura | M |
| 58 | [INF-05](#inf-05) | Postgres sin backups, sin pooling y con credenciales triviales | Infraestructura | M |
| 59 | [INF-06](#inf-06) | Sin política de retención: artefactos y filas crecen sin límite | Infraestructura | M |
| 60 | [INF-07](#inf-07) | Sin proxy inverso ni TLS | Infraestructura | M |
| 61 | [LOG-01](#log-01) | Logging sin estructura y sin `traceId` entre procesos | Logging | M |
| 62 | [LOG-02](#log-02) | Sin métricas ni alertas | Logging | M |
| 63 | [DOC-01](#doc-01) | Comentario en `main.ts` del motor que describe una arquitectura que ya no existe | Documentación | S |

### Prioridad baja (38)

| # | ID | Hallazgo | Categoría | Esf. |
|---|---|---|---|---|
| 64 | [FIA-12](#fia-12) | El campo `seq` se genera pero nadie lo usa | Fiabilidad | S |
| 65 | [FIA-13](#fia-13) | Buffer de subpasos sin expiración | Fiabilidad | S |
| 66 | [FIA-16](#fia-16) | Cancelar en el último instante descarta el resultado real | Fiabilidad | S |
| 67 | [FIA-17](#fia-17) | `cleanupStaleScripts` existe pero nunca se invoca | Fiabilidad | S |
| 68 | [FIA-18](#fia-18) | `stderr` del proceso hijo se acumula sin límite | Fiabilidad | S |
| 69 | [FIA-19](#fia-19) | Sin filtro global de excepciones en el motor | Fiabilidad | S |
| 70 | [REN-04](#ren-04) | N+1 en `linkCollectedArtifacts` | Rendimiento | S |
| 71 | [REN-05](#ren-05) | Se consulta la ruta de filesystem de cada artefacto sin necesidad | Rendimiento | S |
| 72 | [REN-06](#ren-06) | Índices probablemente faltantes (`activo`, `createdAt`) | Rendimiento | S |
| 73 | [REN-07](#ren-07) | 9 componentes con `'use client'` innecesario | Rendimiento | S |
| 74 | [REN-08](#ren-08) | Recharts cargado de forma estática | Rendimiento | S |
| 75 | [REN-09](#ren-09) | Valores de los Context sin `useMemo` | Rendimiento | S |
| 76 | [ERR-03](#err-03) | Se pierde el detalle del error al fallar la publicación a la cola | Errores | S |
| 77 | [ERR-04](#err-04) | Códigos de estado y formato de error inconsistentes | Errores | M |
| 78 | [EST-04](#est-04) | `lib/worker/` ya no contiene ningún worker | Estructura | S |
| 79 | [EST-05](#est-05) | Mezcla de enums de Postgres y `String` con listas cerradas | Estructura | L |
| 80 | [EST-06](#est-06) | Sin unicidad de nombre de Espacio/Proyecto | Estructura | S |
| 81 | [DUP-04](#dup-04) | `CreateCasoForm` reimplementa el `Modal` en una rama muerta | Duplicación | S |
| 82 | [DUP-05](#dup-05) | Buscador duplicado y filtros de servidor inalcanzables en `/ejecuciones` | Duplicación | S |
| 83 | [DUP-06](#dup-06) | `CreateCasoForm` no sigue el patrón de formularios del proyecto | Duplicación | M |
| 84 | [CONV-01](#conv-01) | Mezcla de español e inglés en nombres de funciones | Convenciones | M |
| 85 | [CONV-02](#conv-02) | Comillas y punto y coma inconsistentes; sin Prettier | Convenciones | S |
| 86 | [CONV-03](#conv-03) | `tsconfig.json` divergentes entre proyectos | Convenciones | M |
| 87 | [FE-04](#fe-04) | `EjecutarCasoButton` huérfano, con dos bugs latentes | Frontend | S |
| 88 | [FE-05](#fe-05) | El home del dashboard no tiene `<h1>` | Frontend | S |
| 89 | [FE-06](#fe-06) | Clase de Tailwind inexistente en `kpi-tile.tsx` | Frontend | S |
| 90 | [FE-07](#fe-07) | Contraste de color sin verificar | Frontend | S |
| 91 | [DEP-04](#dep-04) | Dependencias sin uso (`@dnd-kit/*`, `axios` directo en el motor) | Dependencias | S |
| 92 | [CFG-02](#cfg-02) | `execution-consumer` sin health check | Configuración | S |
| 93 | [CFG-03](#cfg-03) | El `Makefile` no funciona en Windows sin Git Bash/WSL | Configuración | S |
| 94 | [INF-08](#inf-08) | `Dockerfile.slim` incluye devDependencies en la imagen final | Infraestructura | S |
| 95 | [INF-09](#inf-09) | Endurecimiento de contenedores incompleto | Infraestructura | M |
| 96 | [INF-10](#inf-10) | Sin estrategia de escalado del motor | Infraestructura | L |
| 97 | [LOG-03](#log-03) | Sin rastreo de errores (Sentry o equivalente) | Logging | S |
| 98 | [LOG-04](#log-04) | `console.*` sueltos en el motor, que usa `Logger` de Nest | Logging | S |
| 99 | [LOG-05](#log-05) | ~100 `console.*` en `vortest-web` sin revisión de datos sensibles | Logging | M |
| 100 | [DOC-02](#doc-02) | Documentos históricos de `openspec/` sin marca de "archivado" | Documentación | S |
| 101 | [DOC-03](#doc-03) | `CLAUDE.md` menciona `components.json`, ya borrado | Documentación | S |

---

## 2. Seguridad

<a id="seg-01"></a>
### SEG-01 · IDOR: descarga de Actas sin verificar pertenencia · **Alta** · S · ✔

**Problema.** `vortest-web/app/api/actas/[id]/download/route.ts:22-53` solo exige una sesión válida (`session.userId`, línea 24) y sirve el PDF. Nunca resuelve a qué proyecto pertenece el Acta ni llama a `requireProyectoAccess`. El comentario del archivo (líneas 7-9) lo justifica con *"el modelo de datos de ACTA hoy es single-tenant / single-user superadmin"* — afirmación que dejó de ser cierta cuando se implementó el RBAC de 3 roles.

**Impacto.** Un tester con acceso solo al Proyecto A descarga el PDF de evidencia de una ejecución de otro cliente: pasos, entorno, URLs internas, capturas. El `consecutivo` es correlativo anual (`2026-0001`, `2026-0002`…), así que no hace falta adivinar UUIDs: se puede enumerar. Es fuga de datos entre clientes.

La inconsistencia es reveladora: `POST /api/ejecuciones/[id]/acta` (que *genera* el PDF) y `GET /api/artefactos/[id]` sí aplican el guard. Solo la descarga quedó sin él. De los 33 route handlers auditados, este es uno de los 4 que carecen de guard de pertenencia.

**Solución propuesta.** Resolver la cadena `Acta → Ejecucion → CasoPrueba → proyectoId` y aplicar el mismo guard que la ruta de artefactos. Corregir el comentario engañoso.

**Cómo implementarlo.**
```ts
const acta = await prisma.acta.findUnique({
  where: { id },
  select: {
    id: true, rutaPdf: true, consecutivo: true,
    ejecucion: { select: { casoPrueba: { select: { proyectoId: true } } } },
  },
});
if (!acta) return NextResponse.json({ error: "not_found" }, { status: 404 });

try {
  await requireProyectoAccess(session, acta.ejecucion.casoPrueba.proyectoId);
} catch {
  return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
}
```
Copiar el manejo de error exacto de `app/api/artefactos/[id]/route.ts:33-40` para mantener consistencia.

---

<a id="seg-02"></a>
### SEG-02 · IDOR de lectura y escritura en sub-recursos de CasoPrueba · **Alta** · S · ✔

**Problema.** Cuatro handlers verifican que el caso **exista** (`findUnique({ select: { id: true } })`) pero nunca que el usuario tenga acceso a su proyecto:
- `app/api/casos/[id]/juego-de-datos/route.ts` — GET (41-69) y **POST (73-181)**
- `app/api/casos/[id]/parametros/route.ts` — GET (26-47)
- `app/api/casos/[id]/parametros/[paramId]/route.ts` — PATCH (35-102)

Compárese con `app/api/casos/[id]/route.ts:21-24`, que sí aplica `requireProyectoAccess`: la omisión es puntual.

**Impacto.**
- **Fuga:** `GET …/juego-de-datos` de un caso ajeno devuelve las filas completas del juego de datos *data-driven* de otro cliente — típicamente datos reales de negocio (cédulas, cuentas, correos).
- **Sabotaje:** el POST hace `deleteMany` + `create` (líneas 153-166), es decir, **reemplaza** el juego de datos del caso ajeno, sin registro de autoría. Un usuario puede destruir silenciosamente los datos de prueba de otro cliente.
- El PATCH permite editar el `valorDefecto` de cualquier parámetro de cualquier caso.

**Solución propuesta.** Aplicar el guard en los 4 handlers.

**Cómo implementarlo.** El mismo parche en los 3 archivos:
```ts
const caso = await prisma.casoPrueba.findUnique({
  where: { id },
  select: { id: true, proyectoId: true },          // ← agregar proyectoId
});
if (!caso) return NextResponse.json({ error: "not_found" }, { status: 404 });
await requireProyectoAccess(session, caso.proyectoId); // ← agregar
```
Ver también [EST-02](#est-02) y [DUP-03](#dup-03), que atacan la causa raíz: que olvidar el guard sea posible.

---

<a id="seg-03"></a>
### SEG-03 · Credenciales de cualquier proyecto listables · **Alta** · S

**Problema.** `app/api/proyectos/[id]/credenciales/route.ts:19-46` solo exige sesión. Sin `requireSuperadmin` ni `requireProyectoAccess`. Además, hay contradicción de política: el comentario del archivo (línea 5) dice *"cualquier rol, no solo superadmin"*, mientras `CLAUDE.md` declara las credenciales como **superadmin-only**.

**Impacto.** Cualquier usuario autenticado lista, iterando IDs, nombre, tipo y vencimiento de las credenciales de todos los proyectos de todos los clientes. El `valor` cifrado no se expone (bien hecho), pero la metadata ya es reconocimiento útil para un atacante interno.

**Solución propuesta.** Decidir cuál de las dos políticas es la correcta, aplicarla, y alinear código y documentación.

**Cómo implementarlo.** Una línea antes de la query: `await requireSuperadmin(session)` (política de `CLAUDE.md`) o `await requireProyectoAccess(session, proyectoId)` (política del comentario). Actualizar el documento que quede desalineado.

---

<a id="seg-04"></a>
### SEG-04 · `next` con dos RCE críticas no autenticadas · **Alta** · S · ✔

**Problema.** `vortest-web` resuelve `next@15.5.22`. `npm audit` reporta dos vulnerabilidades **críticas** que afectan a `< 15.5.24`:
- *Unauthenticated Remote Code Execution on windows-hosted servers*
- *Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used*

**Impacto.** Ejecución remota de código sin autenticación. La primera es especialmente relevante para este equipo: **el desarrollo se hace en Windows**. Cualquier instancia de `next dev`/`next start` alcanzable desde la red es vulnerable.

**Solución propuesta.** Actualizar a `15.5.24` o superior. Está **dentro del rango ya declarado** (`^15.1.0`), así que no hay salto de mayor ni cambios incompatibles esperables.

**Cómo implementarlo.**
```bash
cd vortest-web
npm install next@^15.5.24
npm run typecheck && npm run build
```
Ver [DEP-01](#dep-01) para el resto de vulnerabilidades del mismo proyecto, que se resuelven en la misma pasada, y [DEP-05](#dep-05) para que el CI lo detecte la próxima vez.

---

<a id="seg-05"></a>
### SEG-05 · Ausencia total de rate limiting · **Alta** · M

**Problema.** No existe ningún contador de intentos, backoff ni librería de rate limiting en todo `vortest-web` (búsqueda exhaustiva). Además, el `matcher` de `middleware.ts:26` excluye `/api` por completo, así que ni siquiera hay un punto central donde agregarlo hoy.

**Impacto.** *Credential stuffing* sin fricción contra `/login`. bcrypt con coste 10 da ~100 ms por intento, lo que igual permite miles de intentos por hora por IP. Combinado con [SEG-06](#seg-06), un atacante primero enumera qué correos tienen cuenta y después ataca solo esos.

**Solución propuesta.** Rate limiting por IP + email con bloqueo progresivo en el login, y un límite global más laxo para los endpoints de escritura.

**Cómo implementarlo.** Sin Redis en el stack, lo de menor fricción es una tabla en Postgres:
```prisma
model IntentoLogin {
  id        String   @id @default(uuid())
  clave     String   @unique   // hash de IP + email
  intentos  Int      @default(1)
  ventanaAt DateTime @default(now())
  @@index([ventanaAt])
}
```
Ventana deslizante de 15 min, bloqueo tras 5 fallos. Si más adelante se adopta Redis, migrar a `@upstash/ratelimit`. A nivel de borde, complementar con el proxy de [INF-07](#inf-07).

---

<a id="seg-06"></a>
### SEG-06 · Enumeración de usuarios en el login · **Media** · S

**Problema.** `app/login/actions.ts:19-27` devuelve mensajes y campos distintos según el caso (`"Usuario no encontrado"` en `email` vs. `"Contraseña incorrecta"` en `password`). Además, bcrypt solo se ejecuta si el usuario existe, lo que crea un canal lateral de tiempo (la respuesta es notablemente más rápida cuando el correo no existe).

**Impacto.** Permite saber qué correos corporativos tienen cuenta antes de atacar. Es lo que hace peligroso a [SEG-05](#seg-05).

**Solución propuesta.** Mensaje único y tiempo de respuesta constante.

**Cómo implementarlo.**
```ts
const usuario = await prisma.usuario.findUnique({ where: { email } });
// Hash dummy precalculado al arrancar: iguala el tiempo cuando el usuario no existe.
const ok = await verifyPassword(password, usuario?.passwordHash ?? DUMMY_HASH);
if (!usuario || !ok) return { error: "Credenciales inválidas" };
```

---

<a id="seg-07"></a>
### SEG-07 · Open redirect tras el login · **Media** · S

**Problema.** `searchParams.from` se toma de la URL sin validar (`app/login/page.tsx:10`), viaja en un `<input type="hidden">` y termina en `redirect(from)` (`app/login/actions.ts:33,40`). El middleware genera ese parámetro de forma segura, pero nada impide visitar `/login?from=https://sitio-malicioso.com` directamente.

**Impacto.** Phishing con URL legítima: la víctima se autentica de verdad en vorTest y, **después**, aterriza en un sitio del atacante que le pide "confirmar la contraseña" con la credibilidad del login previo.

**Solución propuesta.** Aceptar solo rutas relativas internas, validando en la Server Action (el borde de confianza real).

**Cómo implementarlo.**
```ts
function rutaInternaSegura(from?: string): string {
  if (!from || !from.startsWith("/")) return "/";
  if (from.startsWith("//") || from.includes("://")) return "/";
  return from;
}
```

---

<a id="seg-08"></a>
### SEG-08 · `ejecucionId` sin validar en la subida interna de artefactos · **Media** · S

**Problema.** `app/api/internal/artefactos/upload/route.ts:110-112`: `fileName` sí se sanea con `path.basename`, pero `ejecucionId` —también del body— se concatena directo en `path.resolve(process.cwd(), 'storage', 'artefactos', ejecucionId)`. Tampoco se verifica que exista una `Ejecucion` con ese ID.

**Impacto.** Escritura fuera de `storage/artefactos/` si `ejecucionId` llega con `../`. Requiere poseer `ENGINE_INTERNAL_SECRET` (por eso no es alta), pero rompe la defensa en profundidad que el propio comentario del archivo dice aplicar.

**Solución propuesta.** Validar formato UUID y existencia antes de tocar el disco.

**Cómo implementarlo.**
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(ejecucionId)) return NextResponse.json({ error: "ejecucionId inválido" }, { status: 400 });
const existe = await prisma.ejecucion.findUnique({ where: { id: ejecucionId }, select: { id: true } });
if (!existe) return NextResponse.json({ error: "ejecucion no encontrada" }, { status: 404 });
```

---

<a id="seg-09"></a>
### SEG-09 · Comparación de secretos no constante en tiempo · **Media** · S

**Problema.** Tres sitios comparan el secreto interno con `!==`, cuyo tiempo depende de cuántos caracteres coinciden desde el inicio:
- `vortest-web/lib/recorder/http-api.ts:110`
- `vortest-web/app/api/internal/artefactos/upload/route.ts:52`
- `vortest-engine/src/internal-http/internal-secret.guard.ts:20`

Los tres lo documentan como decisión deliberada, pero corresponde dejarlo registrado.

**Impacto.** Con suficientes mediciones y baja latencia, se puede inferir el secreto byte a byte. Riesgo real bajo hoy (secreto de alta entropía, tráfico interno), **pero** el puerto 3001 del motor se publica al host (ver [INF-03](#inf-03)), así que en un despliegue sin firewall ese endpoint es alcanzable.

**Solución propuesta.** Un helper compartido con `crypto.timingSafeEqual`, usado en los tres sitios.

**Cómo implementarlo.**
```ts
import { timingSafeEqual } from "node:crypto";
export function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b); // timingSafeEqual lanza si difieren en longitud
}
```

---

<a id="seg-10"></a>
### SEG-10 · El middleware excluye todo `/api` · **Media** · S

**Problema.** `middleware.ts:26` — `matcher: ["/((?!_next/static|…|api).*)"]`. Toda la superficie `/api/**` queda fuera de la verificación de sesión del middleware; cada uno de los 33 route handlers debe verificarla por su cuenta.

**Impacto.** Hoy no hay brecha activa (los 33 verifican la sesión), pero la única protección es la disciplina de cada desarrollador en cada archivo — exactamente el patrón que produjo [SEG-01](#seg-01)–[SEG-03](#seg-03). Un endpoint nuevo que olvide el chequeo queda expuesto sin que nada lo intercepte.

**Solución propuesta.** Verificar la sesión también en el middleware para `/api/**` (excepto `/api/internal/**`, que usa su propio secreto) como capa adicional. No reemplaza los guards de rol/proyecto; cierra la clase de bug "olvidé el chequeo de sesión completo".

**Cómo implementarlo.** Quitar `api` del *negative lookahead* del `matcher`; dentro del middleware, dejar pasar `/api/internal/*` y responder `401` JSON (no redirección) para `/api/*` sin sesión.

---

<a id="seg-11"></a>
### SEG-11 · Sin cabeceras de seguridad HTTP · **Media** · M

**Problema.** `next.config.ts` solo define `output: "standalone"`. No hay `headers()` con CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni `Strict-Transport-Security`; tampoco en `middleware.ts`.

**Impacto.** Sin `X-Frame-Options` / `frame-ancestors`, la app se puede embeber en un iframe malicioso sobre acciones sensibles (eliminar espacio, generar acta): *clickjacking*. Sin CSP, cualquier XSS que se cuele tiene alcance completo.

**Solución propuesta.** Cabeceras básicas ya, CSP primero en modo *report-only* para no romper Monaco (usa *web workers*) ni Recharts.

**Cómo implementarlo.**
```ts
async headers() {
  return [{ source: "/(.*)", headers: [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; frame-ancestors 'none'; …" },
  ]}];
}
```

---

<a id="seg-12"></a>
### SEG-12 · `SESSION_SECRET` reutilizado como clave de cifrado de credenciales · **Media** · M

**Problema.** `lib/credenciales/crypto.ts:21-29` deriva la clave AES-256-GCM de `Credencial.valor` con `scryptSync(SESSION_SECRET, 'acta-credencial-salt', 32)`. Dos superficies de seguridad distintas comparten material.

**Impacto.**
1. Filtrar `SESSION_SECRET` compromete a la vez todas las sesiones **y** todas las credenciales cifradas en reposo.
2. **Rotar `SESSION_SECRET` —buena práctica periódica— deja todas las credenciales existentes indescifrables**, sin plan de recuperación. La primera rotación de rutina destruye datos.

**Solución propuesta.** Clave dedicada con versionado, para poder rotar.

**Cómo implementarlo.** Nueva variable `CREDENCIALES_ENCRYPTION_KEY`; prefijar el texto cifrado con versión (`v1:<iv>:<tag>:<data>`); script `scripts/recifrar-credenciales.ts` que lea con la clave vieja y reescriba con la nueva. Resolver **antes** de habilitar cualquier rotación ([INF-04](#inf-04)).

---

## 3. Fiabilidad del motor y la cola

<a id="fia-01"></a>
### FIA-01 · Si falla el encolado del caso padre, la fila padre queda colgada para siempre · **Alta** · S · ✔

**Problema.** `vortest-web/lib/ejecuciones/actions.ts:136-162`. En el flujo con caso padre se crea `parentEjecucion` con `estado: 'corriendo'` (línea 141) y se publica su job. Si `publishExecuteJob` lanza, el `catch` (157-162) llama `markPublishFailed(ejecucion.id, …)` — que es el **hijo**. La fila del padre nunca se toca. Además, `parentEjecucion` está declarada **dentro** del `try`, así que no es alcanzable desde el `catch` tal como está escrito.

> Nota: el intento de corrección interrumpido no llegó a tocar este código; está igual que en la versión anterior.

**Impacto.** RabbitMQ momentáneamente inalcanzable → el hijo queda correctamente en `errorMotor`, pero el padre queda en `corriendo` indefinidamente, sin ningún mensaje en la cola que lo vaya a resolver. Y como el guard anti-concurrencia (`FOR UPDATE NOWAIT`) impide ejecutar un caso que tenga una ejecución activa, **ese caso padre —típicamente el de login, del que dependen otros— queda inutilizable** hasta que alguien corrija la base a mano.

**Solución propuesta.** Marcar ambas filas en el `catch`.

**Cómo implementarlo.**
```ts
let parentEjecucion: { id: string } | null = null
try {
  parentEjecucion = await prisma.ejecucion.create({ /* … */ })
  await publishExecuteJob(/* … */)
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err)
  if (parentEjecucion) await markPublishFailed(parentEjecucion.id, detail)
  await markPublishFailed(ejecucion.id, `El caso padre no pudo encolarse: ${detail}`)
  finalEstado = 'errorMotor'
}
```

---

<a id="fia-02"></a>
### FIA-02 · Prefetch ilimitado: sin límite de concurrencia · **Alta** · S · ✔

**Problema.** `vortest-engine/src/main.ts:20-33` configura la cola con `queueOptions: { durable: true }` y sin `prefetchCount`. El valor por defecto de NestJS es `0`, y en AMQP `prefetch(0)` significa **sin límite**. No hay semáforo ni chequeo del tamaño de `ActiveJobsRegistry` antes de aceptar un job.

**Impacto.** Se encolan 50 ejecuciones (una suite completa, un usuario impaciente) → RabbitMQ entrega las 50 de golpe a una instancia → el motor lanza 50 `playwright test`, cada uno con su Chromium (~300-500 MB) → OOM. Y como el motor **confirma (ack) apenas registra el job**, esos 50 mensajes ya no se reentregan: las 50 filas quedan en `corriendo` para siempre ([FIA-03](#fia-03)). Un pico de carga destruye todas las ejecuciones en vuelo.

**Solución propuesta.** Limitar el prefetch a la capacidad real, configurable.

**Cómo implementarlo.**
```ts
options: {
  urls: [rabbitmqUrl],
  queue: 'engine.execute',
  queueOptions: { durable: true },
  noAck: false,
  prefetchCount: config.get<number>('ENGINE_MAX_CONCURRENT_JOBS', 3),
}
```
Agregar `ENGINE_MAX_CONCURRENT_JOBS: Joi.number().min(1).default(3)` al esquema de `app.module.ts` y documentarla en `.env.example` (regla práctica: memoria disponible ÷ 500 MB). Hacerla coherente con los límites de [INF-01](#inf-01).

---

<a id="fia-03"></a>
### FIA-03 · Sin watchdog de ejecuciones colgadas · **Alta** · M

**Problema.** El propio diseño lo anticipa: `vortest-engine/src/queue/execute-job.consumer.ts:7-14` dice que el riesgo está *"cubierto por un barrido futuro de filas corriendo sin eventos recientes"*. **Ese barrido nunca se escribió**: no hay ningún proceso, intervalo ni endpoint que revise ejecuciones en `corriendo` contra el tiempo transcurrido. El único timeout (10 min) vive dentro del proceso del motor; si ese proceso muere, el timeout muere con él.

**Impacto.** Cualquier caída del motor tras confirmar un job (OOM por [FIA-02](#fia-02), excepción no capturada, deploy, `kill -9`) deja filas en `corriendo` eternamente: spinner infinito en la UI y —por el guard anti-concurrencia— **el caso de prueba bloqueado sin forma de recuperarlo desde la aplicación**. Es la red de seguridad de la que dependen [FIA-01](#fia-01), [FIA-08](#fia-08), [FIA-13](#fia-13) y [FIA-15](#fia-15): el ítem más rentable de esta sección.

**Solución propuesta.** Barrido periódico en `execution-consumer.ts`, que ya es un proceso de larga vida con acceso a Prisma.

**Cómo implementarlo.**
```ts
const TIMEOUT_MS = Number(process.env.EJECUCION_TIMEOUT_MS ?? 600_000)
const GRACIA_MS = 120_000 // subida de artefactos + latencia de cola

setInterval(async () => {
  const corte = new Date(Date.now() - TIMEOUT_MS - GRACIA_MS)
  const colgadas = await prisma.ejecucion.findMany({
    where: { estado: 'corriendo', inicioAt: { lt: corte } }, select: { id: true },
  })
  if (colgadas.length === 0) return
  await prisma.ejecucion.updateMany({
    where: { id: { in: colgadas.map((e) => e.id) }, estado: 'corriendo' },
    data: { estado: 'errorMotor', finAt: new Date(),
            errorMsg: 'El motor no reportó resultado dentro del tiempo esperado (barrido de recuperación)' },
  })
  colgadas.forEach((e) => clearJobBuffers(e.id)) // resuelve FIA-13
  console.warn(`[barrido] ${colgadas.length} ejecución(es) recuperada(s)`)
}, 60_000).unref()
```
Un barrido que recupera filas con frecuencia es síntoma de un problema aguas arriba: exponerlo como métrica ([LOG-02](#log-02)).

---

<a id="fia-04"></a>
### FIA-04 · `vortest-web` nunca se reconecta a RabbitMQ · **Alta** · M · ✔

**Problema.** `vortest-web/lib/queue/rabbitmq.ts` usa `amqplib` directo (línea 22). La conexión cacheada en `globalForRabbit.__vortestRabbitConn` (52-62) no tiene listeners `error`/`close`; solo el canal de publicación los tiene (71, 75), y el canal de `consumeEngineEvents` ni eso. Tras perderse, la conexión cacheada apunta a un socket muerto para siempre.

**Agravante:** `amqp-connection-manager` **está en `package.json` pero no se importa en ningún archivo** — el intento de corrección instaló la librería y no migró el código. Quien mire las dependencias puede asumir que esto está resuelto.

Contraste: el motor **sí** se reconecta (NestJS usa `amqp-connection-manager` internamente, con reintentos indefinidos). Lo peligroso es la asimetría.

**Impacto.** RabbitMQ reinicia (deploy, actualización, OOM) → el motor vuelve solo, `vortest-web` no → ni `dispararEjecucion` publica ni `execution-consumer` consume → **el sistema queda mudo sin fallar**: procesos vivos, health checks en verde, ninguna ejecución arranca ni se actualiza. Solo se recupera reiniciando a mano, y el síntoma ("todo se quedó pegado") no apunta a la causa.

**Solución propuesta.** Migrar a `amqp-connection-manager` (ya instalada), que reconecta y re-registra consumidores solo.

**Cómo implementarlo.**
```ts
import amqp from 'amqp-connection-manager'

const conn = amqp.connect([process.env.RABBITMQ_URL!], { heartbeatIntervalInSeconds: 30 })
conn.on('disconnect', ({ err }) => console.error('[rabbitmq] desconectado, reintentando:', err?.message))

export function consumeEngineEvents(handler: (e: EngineEvent) => Promise<void>) {
  return conn.createChannel({
    setup: async (ch) => {                 // se re-ejecuta en cada reconexión
      await ch.assertQueue('engine.events', { durable: true })
      await ch.prefetch(1)
      await ch.consume('engine.events', async (msg) => { /* igual que hoy */ })
    },
  })
}
```
Verificar con una prueba real: levantar el stack, `docker compose restart rabbitmq`, y disparar una ejecución sin reiniciar nada más.

---

<a id="fia-05"></a>
### FIA-05 · El directorio de salida de cada ejecución nunca se borra · **Alta** · S

**Problema.** `vortest-engine/src/execution/runner.ts:410-411` crea `runtime/ejecuciones/output/<jobId>` por cada ejecución. El `finally` de `execution.service.ts:153-156` solo borra el script temporal; no hay ningún `fs.rm` sobre ese directorio en todo `src/`.

**Impacto.** Cada ejecución deja su video, capturas y traces en el disco del motor para siempre. Cuando el disco se llena, **fallan todas las ejecuciones nuevas** —ni siquiera se puede escribir el script temporal— con un `ENOSPC` que no apunta a la causa. El fallo no es gradual: de funcionar perfecto a no funcionar nada.

**Solución propuesta.** Borrar el directorio en el `finally`, después de subir los artefactos (haya funcionado la subida o no: el diseño actual no permite reintentarla más tarde).

**Cómo implementarlo.**
```ts
finally {
  const outputDir = path.resolve(process.cwd(), 'runtime', 'ejecuciones', 'output', job.jobId)
  await fs.promises.rm(outputDir, { recursive: true, force: true })
    .catch((e) => this.logger.warn(`[${job.jobId}] No se pudo limpiar outputDir: ${e.message}`))
  cleanupTempScript(scriptPath)
}
```
Construir la ruta igual que `runner.ts:410`, sin depender de que `runResult` exista.

---

<a id="fia-06"></a>
### FIA-06 · Duplicación de jobs entre réplicas del motor · **Media** · S

**Problema.** El dedup de `execution.service.ts:40-43` consulta solo el `ActiveJobsRegistry` local (un `Map` en memoria por instancia). Con 2+ réplicas no hay coordinación.

**Impacto.** Réplica A arranca el job; antes de que el *ack* llegue al broker se cae su conexión → RabbitMQ reentrega → la réplica B lo ejecuta también. Dos Playwright para el mismo `jobId` pisándose en `PasoEjecucion`: el resultado final mezcla dos corridas. Hoy se corre una sola réplica, por eso es media; pasa a alta en cuanto se escale ([INF-10](#inf-10)).

**Solución propuesta.** *Single active consumer* de RabbitMQ (≥ 3.8): elimina la clase "dos réplicas activas a la vez".

**Cómo implementarlo.** `queueOptions: { durable: true, arguments: { 'x-single-active-consumer': true } }`. **Atención:** cambia los argumentos de una cola existente — ver la advertencia de `PRECONDITION_FAILED` en [FIA-10](#fia-10) y aplicar ambos cambios juntos.

---

<a id="fia-07"></a>
### FIA-07 · Cancelar antes de que el motor registre el job no tiene efecto · **Media** · M

**Problema.** `vortest-engine/src/internal-http/internal-http.controller.ts:22-31` devuelve 404 si el job no está en el registro, y `detenerEjecucion` (`vortest-web/lib/ejecuciones/actions.ts:278-300`) trata el 404 como éxito, sin reintentar. El diseño contempla "otra réplica lo tiene" y "ya terminó", pero no el tercer caso: **ninguna réplica lo tiene todavía** (sigue en la cola, o entre recibido y registrado).

**Impacto.** El usuario cancela de inmediato (o hay cola acumulada) → la fila queda `cancelado` → el motor responde 404 → segundos después toma el mensaje y **ejecuta el test igual**: abre un navegador, consume recursos y sube artefactos de una ejecución que la UI muestra como cancelada.

**Solución propuesta.** Mitigación inmediata: reintentar el cancel con backoff durante una ventana corta. Solución de fondo: un canal de cancelación por mensaje (fanout `engine.cancel`) que el motor consulte antes de lanzar el proceso.

**Cómo implementarlo.** Mitigación (S): 3 intentos en ~10 s en `detenerEjecucion`. Fondo (M-L): el motor mantiene un `Set` de cancelaciones recientes (TTL de minutos) alimentado por `engine.cancel`, y lo consulta en `onSpawn`.

---

<a id="fia-08"></a>
### FIA-08 · Sin apagado ordenado del motor · **Media** · M

**Problema.** `vortest-engine/src/main.ts:38` llama `enableShutdownHooks()`, pero ningún provider implementa `OnApplicationShutdown` ni `OnModuleDestroy`. Un `SIGTERM` cierra conexiones sin esperar ni matar los jobs activos.

**Impacto.** En cada deploy, los jobs en vuelo mueren a mitad sin reportar (ya confirmados → sin reentrega → filas colgadas, [FIA-03](#fia-03)).

**Solución propuesta.** Hook de apagado en `ActiveJobsRegistry` que cancele y mate los procesos, con un periodo de gracia configurable.

**Cómo implementarlo.**
```ts
@Injectable()
export class ActiveJobsRegistry implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string) {
    await Promise.allSettled([...this.jobs.values()].map(async (entry) => {
      entry.abortController.abort()
      await killProcessTree(entry.proc.pid, false)
    }))
  }
}
```
Coordinar con `stop_grace_period` en el compose.

---

<a id="fia-09"></a>
### FIA-09 · Contrato de mensajes copiado a mano, sin validación · **Media** · M

**Problema.** `vortest-web/lib/queue/engine-contract.ts` es una copia manual de los tipos de `vortest-engine/src/queue/*`. Los mensajes se castean sin validar (`JSON.parse(…) as EngineEvent` en `rabbitmq.ts:131`; `@Payload() job: ExecuteJobMessage` en el motor). `zod` ya está instalado en `vortest-web`, pero solo se usa en `lib/env.ts`.

**Impacto.** Alguien renombra un campo en el motor y olvida la copia: **ningún compilador lo detecta** (son dos proyectos TypeScript independientes). El error aparece en runtime como un `undefined` silencioso que se propaga hasta que Prisma falla en una columna `NOT NULL`, con un mensaje que no menciona el campo renombrado.

**Solución propuesta.** Validación en el borde con `zod`: no elimina la deriva, pero la convierte de corrupción silenciosa en error explícito en el momento exacto. A futuro, evaluar un esquema único con generación de tipos para ambos proyectos.

**Cómo implementarlo.** Definir `EngineEventSchema` con `z.discriminatedUnion('type', [...])`, derivar el tipo con `z.infer`, y reemplazar el cast por `safeParse`, rechazando (`nack` sin reencolar) y registrando lo que no valide. Instalar `zod` también en el motor para validar el `ExecuteJobMessage` entrante.

---

<a id="fia-10"></a>
### FIA-10 · Mensajes "veneno" se reencolan infinitamente; la DLQ está a medias · **Media** · M

**Problema.**
1. `vortest-engine/src/queue/execute-job.consumer.ts:45` rechaza siempre con `channel.nack(originalMsg, false, true)` — `requeue=true`, sin contador de intentos.
2. `rabbitmq/definitions.json` declara el exchange `engine.dlx` y la cola `engine.execute.dlq`, pero la cola real `engine.execute` **no está enlazada a ellos** (`main.ts` no pasa `x-dead-letter-exchange`). La DLQ existe y no recibe nada. El propio `rabbitmq/rabbitmq.conf` lo documenta.
3. Aunque se enlazara, un `nack` con `requeue=true` **nunca** enruta a la DLQ; y la cola es clásica, así que tampoco soporta `x-delivery-limit`.

**Impacto.** Un job que falla de forma determinística al arrancar (script que no se puede escribir, permisos) se reintenta para siempre, consumiendo CPU y llenando los logs, sin alertar a nadie.

**Solución propuesta.** Cola *quorum* con límite de entregas y DLQ enlazada.

**Cómo implementarlo.**
```ts
queueOptions: {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',
    'x-delivery-limit': 5,
    'x-dead-letter-exchange': 'engine.dlx',
  },
}
```
> ⚠️ **Advertencia operativa:** RabbitMQ exige que los argumentos coincidan al redeclarar una cola. Si `engine.execute` ya existe (por ejemplo en el volumen persistente de un desarrollador), este cambio hace fallar el arranque con **`406 PRECONDITION_FAILED`**. Hay que borrar la cola existente (o usar un nombre nuevo, p. ej. `engine.execute.v2`) antes de desplegarlo. Aplicar junto con [FIA-06](#fia-06).

---

<a id="fia-11"></a>
### FIA-11 · Asociación de capturas a pasos no idempotente · **Media** · M

**Problema.** `vortest-web/lib/worker/artifacts.ts:147-187` (`linkCapturaTestToLastSubaccion`) busca "el subpaso más reciente **sin** captura" (`findFirst` con `capturaActualId: null`, `orderBy numero desc`, líneas 167-172). Es una heurística posicional, no una referencia directa.

**Impacto.** Si el mensaje se reentrega (el *ack* falla tras procesar), la primera entrega ya dejó ese subpaso con captura; la segunda encuentra **otro** subpaso sin captura y le asigna la misma imagen. Resultado: una captura en el paso equivocado del Acta de evidencia. Corrupción silenciosa: el acta se ve bien pero la imagen no corresponde.

**Solución propuesta.** Que el evento `captura-test` lleve una referencia determinística al subpaso.

**Cómo implementarlo.** Agregar `substepNumero` al payload en el reporter del motor y usarlo como `where` directo. Mitigación interina: registrar el `seq` procesado por job y no reaplicar un evento ya visto ([FIA-12](#fia-12)).

---

<a id="fia-12"></a>
### FIA-12 · El campo `seq` se genera pero nadie lo usa · **Baja** · S

**Problema.** `vortest-engine/src/queue/events.publisher.ts:136-152` numera cada evento por job, y su comentario dice que es *"para que el consumidor detecte huecos"*. `execution-consumer.ts` nunca lee `seq`.

**Impacto.** Si un evento se pierde, nada lo nota: el usuario ve un Acta con un paso faltante, como si el test no lo hubiera ejecutado, sin rastro en los logs.

**Solución propuesta / cómo implementarlo.** Un `Map<jobId, number>` con el último `seq` visto; si llega `seq !== último + 1`, registrar un `warn` con el rango faltante. Limpiarlo en `clearJobBuffers`.

---

<a id="fia-13"></a>
### FIA-13 · Buffer de subpasos sin expiración · **Baja** · S

**Problema.** `vortest-web/scripts/execution-consumer.ts:64` (`pendingSubsteps`) solo se limpia al recibir el `end` del job.

**Impacto.** Un job que nunca emite `end` deja su basura en memoria para siempre. Fuga lenta en un proceso pensado para correr semanas.

**Solución propuesta / cómo implementarlo.** Se resuelve con [FIA-03](#fia-03): el barrido llama `clearJobBuffers(jobId)` al recuperar cada fila.

---

<a id="fia-14"></a>
### FIA-14 · El health check del motor no refleja la conexión a RabbitMQ · **Media** · S

**Problema.** `vortest-engine/src/health/health.controller.ts` devuelve `{status:'ok'}` estático (con un `TODO(part2)` explícito). Como `main.ts` no espera a `startAllMicroservices()` antes de levantar el HTTP (decisión correcta, para no colgarse si el broker cae), `/health` responde `ok` aunque el motor nunca haya conectado.

**Impacto.** El orquestador declara sano a un servicio incapaz de recibir un solo job. El healthcheck del compose ([§17](#17-ya-resuelto-en-el-árbol-de-trabajo)) ya lo consulta, así que hoy da una falsa señal de salud.

**Solución propuesta.** Separar *liveness* (`/health`: el proceso vive) de *readiness* (`/ready`: 503 si no hay conexión a RabbitMQ).

**Cómo implementarlo.** Un servicio que mantenga `rmqConnected` desde los eventos `connect`/`disconnect` del transporte. Exponer también `activeJobs: registry.size()` (gratis, y adelanta [LOG-02](#log-02)). Apuntar el healthcheck del compose a `/ready`.

---

<a id="fia-15"></a>
### FIA-15 · El evento `end` es *fire-and-forget* · **Media** · M

**Problema.** `vortest-engine/src/queue/events.publisher.ts:159-183`: `client.emit(...).subscribe({ error: … })` solo registra el error. Si el `emit` falla más allá de lo que el transporte pueda almacenar durante una reconexión breve, el evento se pierde sin reintento.

**Impacto.** Un `end` perdido deja la ejecución en `corriendo` para siempre — el mismo síntoma que [FIA-03](#fia-03), originado del lado del motor. Es indetectable sin el watchdog.

**Solución propuesta.** El watchdog cubre el síntoma. Para el `end` (el único evento que determina el estado terminal), considerar publicación con confirmación (*publisher confirms*) y reintento acotado.

**Cómo implementarlo.** Emitir el `end` con un canal de confirmación y reintentar con backoff si no hay *ack* del broker en X segundos. Sospecha: el grado de mitigación del buffer interno durante reconexiones cortas no se verificó en runtime.

---

<a id="fia-16"></a>
### FIA-16 · Cancelar en el último instante descarta el resultado real · **Baja** · S

**Problema.** `vortest-engine/src/execution/runner.ts:535-562`: si `aborted`, siempre se rechaza con `EjecucionCanceladaError` sin mirar el código de salida, y no se emite `end`.

**Impacto.** Si el test terminó bien justo cuando llegó la cancelación, se pierde el resultado real. El estado visible es correcto (`cancelado`); se pierde evidencia de diagnóstico.

**Solución propuesta / cómo implementarlo.** Emitir siempre el `end` con el resultado real y dejar que el guard existente de `handleEnd` (`where: { estado: 'corriendo' }`) decida si aplicarlo — ya resuelve bien la carrera inversa.

---

<a id="fia-17"></a>
### FIA-17 · `cleanupStaleScripts` nunca se invoca · **Baja** · S

**Problema.** `vortest-engine/src/execution/script-writer.ts:39-57` solo aparece en su propia definición.

**Impacto.** Es el único mecanismo pensado para limpiar scripts huérfanos tras un crash, y no protege nada.

**Solución propuesta / cómo implementarlo.** Invocarla al arrancar en `main.ts` (limpia lo del proceso anterior) y, opcionalmente, en un intervalo.

---

<a id="fia-18"></a>
### FIA-18 · `stderr` del proceso hijo sin límite · **Baja** · S

**Problema.** `vortest-engine/src/execution/runner.ts:456,516,583`: `stderr` se concatena durante toda la ejecución para terminar usando solo `slice(-200)`.

**Impacto.** Un test ruidoso retiene decenas de MB por job durante minutos; multiplicado por jobs concurrentes, agrava [FIA-02](#fia-02).

**Solución propuesta / cómo implementarlo.** Buffer circular de ~2 KB (conservar solo la cola).

---

<a id="fia-19"></a>
### FIA-19 · Sin filtro global de excepciones en el motor · **Baja** · S

**Problema.** No hay `@Catch()` / `ExceptionFilter` en `vortest-engine/src`.

**Impacto.** Bajo: la superficie HTTP son dos endpoints y Nest ya devuelve 500 genérico. Un filtro global daría un registro consistente de excepciones no capturadas.

**Solución propuesta / cómo implementarlo.** Un `AllExceptionsFilter` registrado con `app.useGlobalFilters(...)` que registre con `jobId` cuando exista.

---

## 4. Configuración y uso de Playwright

> Esta sección es nueva respecto a la versión anterior. Los hallazgos **PW-01 a PW-04 son preexistentes a la separación del monolito**: la configuración de Playwright se movió tal cual a `vortest-engine`, y la auto-reparación tampoco estaba conectada en `develop` (verificado). No son regresiones del refactor.

<a id="pw-01"></a>
### PW-01 · Timeout de 60 s contra un presupuesto de job de 10 min · **Alta** · S · ✔

**Problema.** `vortest-engine/playwright.config.ts` fija `timeout: 1 * 60 * 1000` (60 s por test), hardcodeado. El límite real del job es `EJECUCION_TIMEOUT_MS` (600 000 ms por defecto, `vortest-web/lib/ejecuciones/actions.ts:16`), aplicado por el *watchdog* de `runner.ts:594-621`. El `spawn` (`runner.ts:444-452`) no pasa `--timeout`, así que nada sincroniza ambos valores.

Dato histórico que explica el origen: en la versión anterior del archivo, esa misma línea llevaba el comentario `// 10 minutes per execution` — el valor era de 1 minuto y el comentario decía 10.

**Impacto.** Un caso razonable (login + navegación + varios formularios + aserciones), bien dentro de los 10 minutos que el producto comunica, es cortado por Playwright a los 60 s con *"Test timeout of 60000ms exceeded"*. El usuario no puede relacionar ese error con ningún límite que conozca. El presupuesto real es 10 veces menor que el anunciado.

**Solución propuesta.** Derivar el timeout del test del `timeoutMs` del job, dejando margen para la subida de artefactos.

**Cómo implementarlo.** En el `spawn` de `runner.ts`:
```ts
const testTimeout = Math.max(30_000, job.timeoutMs - 60_000) // margen para artefactos
spawn('node', [cliPath, 'test', scriptName, `--config=${configPath}`,
               `--output=${outputDir}`, `--timeout=${testTimeout}`], { /* … */ })
```
Y eliminar (o dejar como fallback documentado) el valor fijo del config.

---

<a id="pw-02"></a>
### PW-02 · `locale: 'es-CO'` con `timezoneId: 'Europe/Madrid'` · **Alta** · S · ✔

**Problema.** `vortest-engine/playwright.config.ts` simula un navegador colombiano (`locale: 'es-CO'`) en la zona horaria de Madrid (UTC+1/+2), 6-7 horas por delante de Bogotá (UTC-5). Es una combinación que ningún usuario real tiene.

**Impacto.** Todo caso que valide fechas u horas mostradas por la página ("creado hace X", horarios de atención, "hoy"/"mañana", validaciones de horario laboral) corre con otra hora del día **y, cerca de la medianoche, con otro día calendario** que el que vería un usuario colombiano. Tests que pasan o fallan según la hora en que se ejecutan, y aserciones que pasan cuando no deberían.

**Solución propuesta.** Zona horaria coherente con el locale; idealmente configurable por proyecto, si hay clientes en otros países.

**Cómo implementarlo.** `timezoneId: 'America/Bogota'`. Para hacerlo configurable: agregar `timezoneId`/`locale` opcionales a `Proyecto`, propagarlos en el `ExecuteJobMessage` y pasarlos al proceso como variables de entorno que el config lea.

---

<a id="pw-03"></a>
### PW-03 · La auto-reparación de selectores nunca se ejecuta · **Alta** · L · ✔

**Problema.** `vortest-web/lib/worker/auto-repair.ts` define `TRY_WITH_REPARACION_SOURCE`, el helper que debería envolver las acciones con selectores de respaldo (HU-G15). **No se usa en ningún archivo fuera de su propia definición y su test** — ni en la rama actual ni en `develop`. `buildScriptText` (`lib/worker/script-temp.ts:24-37`), el único lugar donde se arma el script que se ejecuta, solo agrega el hook de `storageState`. El grabador guarda `selectoresRespaldo` en `PasoGrabado`, pero `spec-builder.ts` reproduce el código de codegen tal cual, sin envolver ninguna acción.

Y el contador "Reparados" de la UI mide otra cosa: `vortest-engine/scripts/my-reporter.js:181-185` marca `selfHealed = result.errors.length > 0` para un test que Playwright dio por **pasado** — típicamente *soft assertions* que fallaron sin detener el test.

**Impacto.** Una capacidad del producto que se ve funcionando (hay contador, hay estado `reparado`) y **nunca ha funcionado**. Un selector roto hace fallar el caso aunque existan respaldos guardados. Y un usuario que ve "Reparados: 3" cree que el sistema recuperó 3 selectores, cuando en realidad hubo 3 tests con errores no fatales — que es casi lo opuesto: un indicador de problemas presentado como un indicador de resiliencia.

**Solución propuesta.** Decisión de producto explícita:
- **(a) Completar la integración:** inyectar el helper y envolver las acciones que tengan ≥ 2 selectores candidatos.
- **(b) No completarla:** quitar o renombrar "Reparados" (por ejemplo "Pasó con advertencias") para dejar de comunicar una capacidad inexistente.

**Cómo implementarlo (opción a).**
1. En `buildScriptText`, anteponer `TRY_WITH_REPARACION_SOURCE` al script.
2. En la generación del `.spec.ts` al guardar un caso, reemplazar cada acción con respaldos por `await tryWithReparacion(page, [principal, ...respaldos], (l) => l.click())`.
3. Emitir un evento explícito cuando se use un respaldo, y basar `selfHealed` en **ese** evento, no en `result.errors`.
4. Aplicar [PW-06](#pw-06) antes: sin `actionTimeout`, el primer selector roto consume todo el presupuesto y los respaldos nunca llegan a probarse.

---

<a id="pw-04"></a>
### PW-04 · Multi-navegador solo en la grabación · **Alta** · M

**Problema.** El grabador permite elegir Chromium, Firefox o WebKit (HU-G34: `lib/grabador/types.ts:12`, `lib/grabador/actions.ts:97-99`, `components/grabador/nueva-grabacion-form.tsx:69,112`) y `SesionGrabacion.navegador` lo persiste. Pero `vortest-engine/playwright.config.ts` declara un único proyecto `chromium`, `ExecuteJobMessage` no tiene campo de navegador, y el `spawn` no pasa `--project`.

**Impacto.** Un caso grabado deliberadamente en Firefox o WebKit (para reproducir un bug de ese motor, o porque el cliente usa Safari) **se ejecuta en Chromium sin ningún aviso**. Si el bug era específico de ese navegador, el caso "pasa": falso negativo de cobertura *cross-browser*.

**Solución propuesta.** Propagar el navegador hasta la ejecución, o dejar claro en la UI que solo aplica a la grabación.

**Cómo implementarlo.** Agregar `navegador` a `CasoPrueba` (o tomarlo de la sesión de grabación de origen) y a `ExecuteJobMessage`; declarar los tres `projects` en `playwright.config.ts`; pasar `--project=${job.navegador ?? 'chromium'}` en el `spawn`. La imagen del motor ya trae los tres navegadores.

---

<a id="pw-05"></a>
### PW-05 · `trace` existe en el modelo pero nunca se genera · **Media** · S

**Problema.** `ArtefactoTipo` incluye `trace` (`vortest-web/prisma/schema.prisma:36-40`, y los tipos del motor). Pero el config no define `trace:` en `use`, así que Playwright nunca produce el `.zip`; y aunque lo produjera, `vortest-engine/src/artifacts/artifacts.service.ts` solo recolecta `.webm` y `.png`.

**Impacto.** Cuando un caso falla de forma intermitente, la herramienta de diagnóstico más potente de Playwright (Trace Viewer: DOM en cada paso, red, línea de tiempo) no está disponible. Solo hay video y capturas.

**Solución propuesta.** Generar traces al menos en fallos, o quitar `trace` del modelo para no prometer lo que no existe.

**Cómo implementarlo.** `trace: 'retain-on-failure'` en `use` (equilibrio entre utilidad y almacenamiento); agregar `.zip` al filtro de `collectAndUploadArtifacts` mapeado a `tipo: 'trace'`; en la UI, un enlace a `trace.playwright.dev` con el archivo.

---

<a id="pw-06"></a>
### PW-06 · Sin timeouts de acción, navegación y aserción · **Media** · S

**Problema.** El config no define `use.actionTimeout`, `use.navigationTimeout` ni `expect.timeout`. Todos quedan acotados solo por el timeout global del test.

**Impacto.** Un selector que no existe consume casi todo el presupuesto del test esperando antes de fallar. Con la auto-reparación conectada ([PW-03](#pw-03)), el primer candidato roto agotaría el tiempo y los respaldos —que existen justamente para ese caso— nunca se probarían: el mecanismo se anularía solo.

**Solución propuesta / cómo implementarlo.**
```ts
use: { actionTimeout: 10_000, navigationTimeout: 30_000 },
expect: { timeout: 10_000 },
```
Y en el helper de auto-reparación, pasar un `{ timeout }` explícito a cada candidato, repartiendo el presupuesto.

---

<a id="pw-07"></a>
### PW-07 · El lint de selectores frágiles cubre un solo patrón · **Media** · M

**Problema.** `vortest-web/lib/recorder/selector-lint.ts:26` solo detecta `page.locator('<etiqueta>').first()/.last()/.nth(N)`. No detecta `:nth-child` dentro del selector CSS, clases generadas (`.css-1a2b3c`, `.MuiButton-root-xyz`), XPath absolutos (`//div[3]/span[2]`), IDs autogenerados (`#mui-12345`) ni selectores compuestos por posición.

**Impacto.** Los scripts que genera codegen se guardan sin post-procesamiento; las categorías de selector frágil más comunes pasan sin ninguna advertencia y rompen el caso en la siguiente versión del sitio bajo prueba.

**Solución propuesta.** Ampliar el lint con reglas independientes, manteniendo el diseño de "avisar, no bloquear".

**Cómo implementarlo.** Una lista de reglas `{ regex, mensaje }`: `:nth-(child|of-type)`, `xpath=` o selectores que empiezan con `//`, clases con sufijo hash (`/\.[a-z]+-[a-z0-9]{5,}\b/`), IDs con secuencias numéricas largas. Sugerir en cada mensaje la alternativa recomendada por Playwright (`getByRole`, `getByTestId`).

---

<a id="pw-08"></a>
### PW-08 · El parser del reporter acepta JSON de cualquier origen · **Media** · S

**Problema.** `vortest-engine/src/execution/runner.ts:118-127` (`parseReporterEvent`) acepta cualquier línea de stdout que sea JSON con un `type` válido (`env`, `step`, `end`…). `my-reporter.js` no marca sus líneas de ninguna forma.

**Impacto.** Si el script del usuario hace `console.log(JSON.stringify({ type: 'end', … }))` —un patrón común al depurar respuestas de API— esa línea se interpreta como evento real y puede forzar un `end` prematuro o corromper contadores. *Sospecha con alta probabilidad:* el reenvío de `console.log` del test al stdout del proceso principal es comportamiento documentado de Playwright, pero no se verificó ejecutándolo.

**Solución propuesta / cómo implementarlo.** Prefijo centinela único: `my-reporter.js` emite `__VORTEST__{...json}` y el parser solo procesa líneas con ese prefijo.

---

<a id="pw-09"></a>
### PW-09 · Fallos al guardar el `storageState` del padre se tragan en silencio · **Media** · S

**Problema.** El hook inyectado en `vortest-web/lib/worker/script-temp.ts:30` termina en `.catch(() => {})`, y `readStorageState` del motor devuelve `null` sin registrar nada. Tampoco se valida si las cookies del `storageState` siguen vigentes antes de inyectarlas en el hijo.

**Impacto.** El padre "pasa", pero su `afterEach` no logra escribir el `storageState` → el `end` llega sin él → `execution-consumer` publica igual el job del hijo, **sin sesión** → el hijo falla en el primer paso que requiere login con un error genérico. El usuario ve dos resultados aparentemente inconexos y ninguna pista de la causa real.

**Solución propuesta.** Registrar el fallo, y detectar explícitamente "había padre pero no llegó `storageState`".

**Cómo implementarlo.** Cambiar el `.catch(() => {})` por `.catch((e) => console.error('[vortest] no se pudo guardar storageState:', e))`. En `handlePendingChild`, si falta el `storageState` del padre, marcar el hijo como `errorMotor` con el mensaje *"el caso padre no produjo sesión"* en vez de ejecutarlo sin ella. Opcional: verificar `expires` de las cookies antes de reinyectar.

---

## 5. Rendimiento

<a id="ren-01"></a>
### REN-01 · El poll de 2 s nunca se detiene · **Alta** · S

**Problema.** `vortest-web/components/ejecuciones/ejecucion-detalle-client.tsx:142-164`. El `useEffect` depende solo de `poll`, y `poll` solo de `ejecucionId`: el `setInterval` se crea una vez y corre cada 2 s **mientras la pestaña esté abierta**, aunque la ejecución haya terminado hace horas. (Sí se limpia al desmontar.)

**Impacto.** Una pestaña olvidada hace **1 800 peticiones por hora**, cada una con `casoPrueba → proyecto → espacio`, `pasos → subacciones → capturas` y `artefactos`. Cinco personas con pestañas abiertas son 9 000 consultas/hora con múltiples JOIN contra Postgres, sin que nadie esté mirando nada.

**Solución propuesta.** Cortar el intervalo al llegar a un estado terminal; opcionalmente, pausar con la pestaña oculta.

**Cómo implementarlo.**
```ts
const TERMINALES = ['paso', 'fallo', 'reparado', 'errorMotor', 'cancelado']

useEffect(() => {
  if (TERMINALES.includes(ejecucion.estado)) return
  poll()
  const id = setInterval(() => { if (!document.hidden) poll() }, 2000)
  return () => clearInterval(id)
}, [poll, ejecucion.estado])
```

---

<a id="ren-02"></a>
### REN-02 · Listados sin paginación en base de datos · **Alta** · L

**Problema.** Ningún listado usa `take`/`skip`/cursor: `listEjecuciones` (`lib/ejecuciones/queries.ts:38-61`), `listCasos` (`lib/casos/actions.ts:137-160`, que además incluye `ejecuciones` y `pasos` **por cada caso**), `listProyectos*`, `listEspacios`, `listUsuarios`. `/ejecuciones` trae la tabla completa, filtra `q`/`estado` **en memoria del servidor** (`app/(dashboard)/ejecuciones/page.tsx:16-55`) y el componente pagina de a 10 **en memoria del navegador** (`components/ejecuciones/ejecuciones-list.tsx:43-61`).

**Impacto.** El propósito del producto es correr ejecuciones continuamente: la tabla `Ejecucion` crece de forma monótona. En pocos meses cada carga del listado o del home es un recorrido completo más un JSON enorme serializado al cliente para pintar 10 filas. No es un escenario lejano: es el uso normal.

**Solución propuesta.** Paginación por cursor en Prisma, con los filtros en el `where`.

**Cómo implementarlo.**
```ts
export async function listEjecuciones(usuario, { cursor, take = 20, q, estado } = {}) {
  const filas = await prisma.ejecucion.findMany({
    where: {
      ...scopeProyectoWhere(usuario),
      ...(estado ? { estado } : {}),
      ...(q ? { casoPrueba: { nombre: { contains: q, mode: 'insensitive' } } } : {}),
    },
    select: { /* solo lo que la lista muestra */ },
    orderBy: { createdAt: 'desc' },
    take: take + 1,                                         // +1 para saber si hay más
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return { filas: filas.slice(0, take), siguiente: filas[take]?.id ?? null }
}
```
Priorizar `listEjecuciones` y `listCasos`. Requiere decidir el patrón de UI ("cargar más" o paginador) — ver [DUP-05](#dup-05).

---

<a id="ren-03"></a>
### REN-03 · `requestAnimationFrame` perpetuo en la barra de capítulos · **Media** · S

**Problema.** `vortest-web/components/ejecuciones/video-chapter-bar.tsx:43-61`: el bucle `rAF` se reprograma incondicionalmente, leyendo `video.currentTime` ~60 veces por segundo aunque el video nunca se haya reproducido o esté pausado.

**Impacto.** CPU y batería consumidas continuamente en la misma pantalla del poll de [REN-01](#ren-01).

**Solución propuesta / cómo implementarlo.** Reemplazar el `rAF` por el evento nativo `timeupdate` del `<video>` (que no se dispara en pausa). Si se necesita más resolución, arrancar el `rAF` en `play` y cancelarlo en `pause`/`ended`.

---

<a id="ren-04"></a>
### REN-04 · N+1 en `linkCollectedArtifacts` · **Baja** · S

**Problema.** `vortest-web/lib/worker/artifacts.ts:196-221`: un `findUnique` por artefacto dentro de un `for`.

**Impacto.** Bajo: corre en segundo plano y los artefactos por ejecución son pocos. Se registra para que no escale si crecen las capturas por paso.

**Solución propuesta / cómo implementarlo.** Un solo `findMany({ where: { ejecucionId, numero: { in: numeros } } })` antes del bucle y resolver contra un `Map` — el mismo patrón que ya usan bien `getMetrics` / `getEspaciosMetrics`.

---

<a id="ren-05"></a>
### REN-05 · Se consulta la ruta de filesystem de cada artefacto · **Baja** · S

**Problema.** `vortest-web/lib/ejecuciones/queries.ts:29-31` incluye `artefactos` sin `select`, trayendo `path` (ruta absoluta del servidor). Hoy no se filtra al cliente porque el route handler descarta el campo a mano.

**Impacto.** Datos innecesarios por cada poll ([REN-01](#ren-01)) y una protección frágil: un cambio futuro en el mapeo de respuesta podría exponer rutas internas sin que nadie lo note.

**Solución propuesta / cómo implementarlo.** `select: { id: true, tipo: true, nombre: true, bytes: true }` en el `include`.

---

<a id="ren-06"></a>
### REN-06 · Índices probablemente faltantes · **Baja** · S · *sospecha*

**Problema.** `CasoPrueba` tiene `@@index([proyectoId])` y `Proyecto` `@@index([espacioId])`, pero casi todos los listados filtran además por `activo: true`. `Ejecucion` no tiene índice sobre `createdAt`, que es el `orderBy` de `listEjecuciones`.

**Impacto.** A la escala actual, probablemente imperceptible. Con volumen, recorridos completos en las consultas más frecuentes.

**Solución propuesta / cómo implementarlo.** Medir primero con `EXPLAIN ANALYZE` sobre volumen real. Si se confirma: `@@index([proyectoId, activo])`, `@@index([espacioId, activo])` y `@@index([createdAt])`.

---

<a id="ren-07"></a>
### REN-07 · 9 componentes con `'use client'` innecesario · **Baja** · S

**Problema.** Sin hooks, eventos ni APIs del navegador (verificado leyendo cada uno): `components/ejecuciones/origen-chip.tsx`, `ejecuciones/reparados-counter.tsx`, `ui/kpi-tile.tsx`, `ui/client-band.tsx`, `ui/page-header.tsx`, `ui/scope-bar.tsx`, `ui/execution-status-bar.tsx`, `grabador/recording-guide.tsx`, `grabador/recording-instructions.tsx`.

**Impacto.** JavaScript y costo de hidratación innecesarios en componentes que aparecen en casi todas las páginas (`PageHeader`, `ScopeBar`, `KpiTile`).

**Solución propuesta / cómo implementarlo.** Quitar la directiva de los 9 y verificar con `npm run build` (ninguno recibe funciones por props, así que pueden ser Server Components).

---

<a id="ren-08"></a>
### REN-08 · Recharts cargado de forma estática · **Baja** · S

**Problema.** `components/dashboard/ejecuciones-por-espacio-chart.tsx:3` y `distribucion-resultados-chart.tsx:3` lo importan directo, aunque solo se renderizan si hay ejecuciones.

**Solución propuesta / cómo implementarlo.** `dynamic(() => import(...), { ssr: false, loading: () => <Skeleton /> })`, igual que ya se hace correctamente con Monaco.

---

<a id="ren-09"></a>
### REN-09 · Valores de los Context sin `useMemo` · **Baja** · S

**Problema.** `components/project-context.tsx:26`, `breadcrumb-context.tsx:27`, `mobile-nav-context.tsx:23-30` crean el objeto `value` en cada render (el último recrea además las funciones).

**Impacto.** Hoy no causa re-renders reales: el `layout.tsx` es Server Component y `children` es estable. Pero si alguien envuelve `{children}` en un componente cliente intermedio, aparecen re-renders en cascada sin ninguna señal.

**Solución propuesta / cómo implementarlo.** `useMemo` en cada `value` y `useCallback` en las funciones: una línea por provider que elimina la dependencia de esa invariante implícita.

---

## 6. Manejo de errores y casos límite

<a id="err-01"></a>
### ERR-01 · Dos convenciones de error, con un parche para los tests · **Media** · M

**Problema.** Conviven objetos `{ status, body }` lanzados como excepción (mayoría de `lib/*/actions.ts`) y *sentinels* comparados por identidad y por mensaje: `err === FORBIDDEN_ERROR || err?.message === "FORBIDDEN"` en `app/api/casos/route.ts:30`, `casos/[id]/route.ts:26`, `ejecuciones/route.ts:32-40` (tres variantes), `ejecuciones/[id]/detener/route.ts:24-43`, `proyectos/[id]/route.ts:26-30`, `espacios/[id]/route.ts:34`. La doble condición existe porque al mockear `@/lib/auth` el sentinel del mock no es `===` al real.

**Impacto.** El mecanismo es frágil por diseño (ya necesitó un parche) y cada handler nuevo debe acordarse de mapear ambas convenciones. Un error mal mapeado sale como 500 en vez de 403.

**Solución propuesta.** Clases de error tipadas con su propio `status`, y un único traductor a respuesta.

**Cómo implementarlo.**
```ts
export class AppError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code) }
}
export const FORBIDDEN_ERROR = new AppError(403, 'forbidden')

export function mapErrorToResponse(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: err.code }, { status: err.status })
  console.error(err)
  return NextResponse.json({ error: 'internal' }, { status: 500 })
}
```
Se combina naturalmente con el wrapper de [DUP-03](#dup-03).

---

<a id="err-02"></a>
### ERR-02 · Columnas `Json` sin validación de forma · **Media** · M

**Problema.** `vortest-web/prisma/schema.prisma`: `Ejecucion.storageState` (201), `SesionGrabacion.storageState` (358), `PasoEjecucion.logs` (242), `PasoSubaccion.logs` (265), `Artefacto.metadata` (288), `JuegoDeDatos.filas` (452), `PasoGrabado.selectorPrincipal/selectoresRespaldo` (406-407). Prisma no tipa `Json`, y nada valida al escribir ni al leer.

**Impacto.** Si el formato cambia (actualización de Playwright, cambio en el motor), el error aparece lejos de su origen: por ejemplo, un `storageState` inválido solo se descubre cuando Playwright falla al usarlo en el caso hijo.

**Solución propuesta / cómo implementarlo.** Esquemas `zod` por columna, aplicados en los bordes (al recibir el `end` del motor, al leer el `storageState` para reutilizarlo, al persistir filas del CSV). Encaja con [FIA-09](#fia-09).

---

<a id="err-03"></a>
### ERR-03 · Se pierde el detalle del error al fallar la publicación · **Baja** · S

**Problema.** `vortest-web/lib/ejecuciones/actions.ts:38-51` (`markPublishFailed`) guarda solo el mensaje del error de `amqplib` en `errorMsg`, sin código ni stack.

**Solución propuesta / cómo implementarlo.** Registrar el error completo (con `ejecucionId`) antes de persistir el mensaje resumido, y guardar el código de error de AMQP si existe.

---

<a id="err-04"></a>
### ERR-04 · Códigos de estado y formato de error inconsistentes · **Baja** · M

**Problema.** `POST /api/casos/[id]/ejecutar` crea una ejecución y devuelve 200 (`route.ts:65-68`); `POST /api/ejecuciones` hace **lo mismo** y devuelve 201 (`route.ts:21`). Los errores mezclan español (`"No autenticado"`) e inglés (`"unauthorized"`, `"forbidden"`), sin un campo `code` estable.

**Impacto.** El frontend tiene que comparar strings para distinguir errores, y un cambio de texto rompe la lógica.

**Solución propuesta / cómo implementarlo.** Contrato único `{ error: { code, message } }`, `code` en inglés estable y `message` en español para el usuario; 201 para toda creación. Sale gratis con [ERR-01](#err-01).

---

## 7. Estructura, arquitectura y organización

<a id="est-01"></a>
### EST-01 · Tres puntos de entrada para disparar una ejecución · **Media** · L

**Problema.** `app/api/casos/[id]/ejecutar/route.ts:64`, `app/api/ejecuciones/route.ts:20` (POST) y la Server Action `dispararEjecucion`. Los tres convergen en la misma función (el guard se aplica en los tres), pero con contratos distintos (`{ ejecucionId, redirectTo }` / 200 vs. `{ id, estado }` / 201). El propio comentario del primer archivo lo señala como deuda.

**Impacto.** Superficie duplicada que hay que mantener y probar por triplicado.

**Solución propuesta / cómo implementarlo.** Declarar canónica la Server Action (la UI usa Server Actions), marcar las rutas como obsoletas, migrar consumidores y eliminarlas.

---

<a id="est-02"></a>
### EST-02 · Los getters dependen de que el llamador aplique el guard · **Media** · M

**Problema.** `getCasoById` (`lib/casos/actions.ts:215-251`) y `getProyectoById` (`lib/proyectos/actions.ts:102-129`) no reciben `session` ni aplican guard: dependen de que el route handler lo haga antes. En el mismo archivo, `createCaso`/`updateCaso`/`deleteCaso` sí reciben `session` y se protegen solos.

**Impacto.** Es exactamente el diseño que produjo [SEG-02](#seg-02): cualquier llamador nuevo que olvide el guard reintroduce un IDOR, sin que nada lo impida ni lo señale.

**Solución propuesta / cómo implementarlo.** Cambiar la firma a `getCasoById(id, session)` y aplicar `requireProyectoAccess` dentro, tras resolver el `proyectoId`. Actualizar los pocos llamadores y quitar el guard duplicado de los handlers. Con esto, una clase entera de bug deja de ser posible.

---

<a id="est-03"></a>
### EST-03 · Archivos cliente de 600-700 líneas con componentes embebidos · **Media** · M

**Problema.** `app/(dashboard)/usuarios/usuarios-client.tsx` (718 líneas) define 9 componentes (`RolBadge`, `EspaciosCell`, `EstadoBadge`, `RowActions`, `UsuarioTr`, `UsuarioCard`, `PaginacionFooter`, `EditUsuarioDialog`…). `app/(dashboard)/espacios/espacios-client.tsx` (610) define 4 más helpers. El resto de dominios (`casos`, `ejecuciones`, `proyectos`) sí separa subcomponentes en `components/<dominio>/`.

**Impacto.** Difícil de navegar, diffs ruidosos, y rompe la convención que el resto del proyecto sigue. Crece con cada funcionalidad nueva de usuarios o espacios.

**Solución propuesta / cómo implementarlo.** Extraer cada subcomponente a `components/usuarios/*.tsx` y `components/espacios/*.tsx`, dejando el `*-client.tsx` como orquestador de estado.

---

<a id="est-04"></a>
### EST-04 · `lib/worker/` ya no contiene ningún worker · **Baja** · S

**Problema.** Tras la separación, `lib/worker/` contiene vinculación de artefactos, plantillas de script, un lock y validación — nada de proceso. El worker real es `scripts/execution-consumer.ts`. Además, `components/ejecuciones/reparados-counter.tsx` (UI) importa lógica de dominio desde ahí.

**Impacto.** Confunde a quien llega: el nombre sugiere lógica de proceso de larga vida.

**Solución propuesta / cómo implementarlo.** Redistribuir por dominio (`lib/ejecuciones/artifacts.ts`, `lib/ejecuciones/script.ts`…) o renombrar a `lib/motor/`. Son ~10 imports.

---

<a id="est-05"></a>
### EST-05 · Mezcla de enums nativos y `String` con listas cerradas · **Baja** · L

**Problema.** `EjecucionEstado`, `ArtefactoTipo`, `Rol` son enums de Postgres; pero `PasoSubaccion.tipo` (260), `Credencial.tipo` (325), `SesionGrabacion.estado` (361), `PasoGrabado.tipo/origen` (403-404) y `ParametroGrabacion.origen` (432) son `String` validados solo en la aplicación.

**Impacto.** Un seed, script o migración puede insertar valores fuera de lista sin que la base lo impida.

**Solución propuesta / cómo implementarlo.** Migrar a enums uno por uno, con migración de datos existentes. Esfuerzo alto por la migración; prioridad baja.

---

<a id="est-06"></a>
### EST-06 · Sin unicidad de nombre de Espacio/Proyecto · **Baja** · S

**Problema.** No hay `@@unique([espacioId, nombre])` en `Proyecto` ni unicidad en `Espacio.nombre`.

**Impacto.** Selectores de la UI con opciones indistinguibles. Puede ser una decisión de producto válida.

**Solución propuesta / cómo implementarlo.** Decidir la regla de negocio; si aplica, restricción de unicidad (verificando antes que no haya duplicados existentes).

---

## 8. Código duplicado y patrones inconsistentes

<a id="dup-01"></a>
### DUP-01 · Formato de fechas y duraciones reimplementado 11 veces · **Media** · M

**Problema.** No existe un módulo de formato (`lib/utils.ts` solo tiene `cn()`). Hay implementaciones en:
- `components/ejecuciones/ejecucion-summary.tsx:16,25`, `ejecuciones-list.tsx:24,33` y `lib/acta/template.ts:29,38` — idénticas entre sí
- `components/ejecuciones/paso-accordion-item.tsx:43` y `paso-subaccion-item.tsx:58` — otra variante (solo segundos)
- `components/ui/acta-header.tsx:23,33` — otra firma (recibe dos `Date`)
- `components/ui/execution-timeline.tsx:50` — otra rama para `< 1000 ms`
- `app/(dashboard)/page.tsx:32`, `usuarios-client.tsx:26`, `espacios-client.tsx:44`, `components/casos/caso-table.tsx:19` — fechas y tiempo relativo, cada una distinta

**Impacto.** No es solo duplicación: **los resultados difieren**. Una duración sale `1.5s` en una pantalla y `90s` en otra; unas fechas llevan año y otras no. El usuario ve el mismo dato con formato distinto en la lista, el detalle y el Acta PDF de la misma ejecución.

**Solución propuesta / cómo implementarlo.** `lib/format.ts` con `formatDuration(ms, { corto?: boolean })`, `formatFecha(d, { conHora?: boolean })` y `formatRelativo(d)`, usando `Intl` con locale `es-CO`. Migrar los 11 sitios y fijar el formato canónico con el equipo de producto.

---

<a id="dup-02"></a>
### DUP-02 · Estado → color/etiqueta en 4 lugares, con dos vocabularios · **Media** · M

**Problema.** `components/ui/status-badge.tsx:13` es el componente canónico (su comentario dice que existe para reemplazar los badges hechos a mano). Pero `ejecuciones/ejecucion-status.tsx:14`, `paso-accordion-item.tsx:48,57` y `paso-subaccion-item.tsx:63,72` (estos dos idénticos) tienen su propio mapeo. Y el vocabulario difiere: la ejecución dice **"Pasó / Falló"** y el paso dice **"Conforme / No conforme"** para el mismo valor `paso` / `fallo`.

**Impacto.** El usuario lee dos términos distintos para el mismo concepto en la misma pantalla; y cambiar un color o una etiqueta exige tocar 4 archivos.

**Solución propuesta / cómo implementarlo.** `lib/ejecuciones/estado.ts` con `ESTADO_LABEL` y `ESTADO_TONE`; migrar los tres componentes a `StatusBadge`. Decidir un único vocabulario — si "Conforme" viene del lenguaje de actas de evidencia, usarlo en todo el producto.

---

<a id="dup-03"></a>
### DUP-03 · Boilerplate de autenticación en 15+ route handlers · **Media** · M

**Problema.** `if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 })` se repite casi textual en al menos 15 archivos de `app/api/**` (entre otros: `actas/[id]/download:25`, `casos/route.ts:10,50`, `casos/[id]/ejecutar:37`, `casos/[id]/juego-de-datos:44,76`, `ejecuciones/[id]/route.ts:13`, `espacios/route.ts:10,25`).

**Impacto.** Cualquier cambio de contrato exige tocar 15+ archivos, y el copiar y pegar es precisamente cómo se omitieron guards en [SEG-01](#seg-01)–[SEG-03](#seg-03).

**Solución propuesta / cómo implementarlo.** Un wrapper de orden superior:
```ts
export const withAuth = <C>(handler: (req: Request, ctx: C, session: SessionData) => Promise<Response>) =>
  async (req: Request, ctx: C) => {
    const session = await getSession()
    if (!session.userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 })
    try { return await handler(req, ctx, session) }
    catch (err) { return mapErrorToResponse(err) } // ERR-01
  }
```

---

<a id="dup-04"></a>
### DUP-04 · `CreateCasoForm` reimplementa el `Modal` en una rama muerta · **Baja** · S

**Problema.** `components/casos/create-caso-form.tsx:192-217` tiene una rama sin `embedded` que reimplementa el backdrop del `Modal` con sus mismas clases. Su único llamador (`mode-selector-modal.tsx:209`) siempre pasa `embedded`: la rama nunca se ejecuta en la aplicación.

**Solución propuesta / cómo implementarlo.** Quitar la prop `embedded` y el branching; devolver siempre el cuerpo del formulario.

---

<a id="dup-05"></a>
### DUP-05 · Buscador duplicado y filtros inalcanzables en `/ejecuciones` · **Baja** · S

**Problema.** `app/(dashboard)/ejecuciones/page.tsx:8-55` filtra por `searchParams.q`/`estado`, pero **ningún enlace ni formulario genera esas URLs**. Mientras tanto, `ejecuciones-list.tsx:73-85` tiene su propio buscador en cliente, reimplementando el markup de `components/ui/section-search.tsx`.

**Solución propuesta / cómo implementarlo.** Al resolver [REN-02](#ren-02), el filtrado en base pasa a ser el real: exponerlo con `<SectionSearch>` sincronizado a la URL y eliminar el filtro en cliente.

---

<a id="dup-06"></a>
### DUP-06 · `CreateCasoForm` no sigue el patrón de formularios del proyecto · **Baja** · M

**Problema.** `components/casos/create-caso-form.tsx:26-96` usa 7 `useState`, `fetch` manual y un `if/else` por código HTTP. `app/login/login-form.tsx` muestra el patrón idiomático que el equipo ya domina (Server Action + `useActionState`).

**Solución propuesta / cómo implementarlo.** Migrar a una Server Action en `lib/casos/actions.ts` + `useActionState`, tomando `login-form.tsx` como modelo.

---

## 9. Convenciones de nombres y estilo

<a id="conv-01"></a>
### CONV-01 · Mezcla de español e inglés en nombres de funciones · **Baja** · M

**Problema.** Conviven `listCasos`, `getMetrics`, `getProyectoById` con `dispararEjecucion`, `detenerEjecucion`, `asignarAdminEspacio`, `iniciarSesionGrabacion`. Las rutas de API son consistentes en español salvo `logout`.

**Impacto.** Hay que recordar dos convenciones según el archivo.

**Solución propuesta / cómo implementarlo.** Fijar una regla y documentarla en `CLAUDE.md`. Sugerencia coherente con el código actual: verbos de negocio en español (el dominio y el producto son en español), verbos técnicos de CRUD (`list`, `get`) en inglés. Aplicarla de forma progresiva, no en un refactor masivo.

---

<a id="conv-02"></a>
### CONV-02 · Comillas y punto y coma inconsistentes; sin Prettier · **Baja** · S

**Problema.** `components/ui/modal.tsx` y `components/casos/create-caso-form.tsx` usan comillas dobles y punto y coma; `ejecuciones-list.tsx`, `video-chapter-bar.tsx` y `ejecucion-status.tsx` usan comillas simples sin punto y coma. No hay configuración de Prettier.

**Solución propuesta / cómo implementarlo.** `.prettierrc` en la raíz, una pasada de formato **en un commit aislado** (para no mezclar ruido con cambios reales) y `prettier --check` en el CI.

---

<a id="conv-03"></a>
### CONV-03 · `tsconfig.json` divergentes entre proyectos · **Baja** · M

**Problema.** `vortest-web`: target `ES2017`, `strict`. `vortest-engine`: target `ES2021`, `strict` más un `strictNullChecks` redundante y `noFallthroughCasesInSwitch: false`. Ninguno usa `noUncheckedIndexedAccess`.

**Solución propuesta / cómo implementarlo.** Documentar el piso mínimo común; activar `noUncheckedIndexedAccess` (atrapa accesos a arrays sin verificar) en un esfuerzo dedicado, porque generará errores que habrá que corregir.

---

## 10. Frontend, UX y accesibilidad

<a id="fe-01"></a>
### FE-01 · El `Modal` compartido no atrapa ni restaura el foco · **Media** · M

**Problema.** `components/ui/modal.tsx:23-56` tiene `role="dialog"`, `aria-modal`, Escape y clic fuera, pero no mueve el foco al abrir, no atrapa `Tab` y no lo devuelve al cerrar. Solo `ModeSelectorModal` resuelve el foco inicial, y a mano.

**Impacto.** Como es la base de `ConfirmDialog`, la edición de casos y los diálogos de testers y admins, el problema está en **todos** los diálogos: un usuario de teclado o lector de pantalla puede quedar navegando el contenido de fondo sin saber cómo volver.

**Solución propuesta / cómo implementarlo.** Un hook `useFocusTrap(ref, open)` dentro de `Modal`: guardar `document.activeElement`, enfocar el primer elemento enfocable, ciclar `Tab`/`Shift+Tab` en los extremos, restaurar al cerrar. Luego quitar el parche de `ModeSelectorModal`.

---

<a id="fe-02"></a>
### FE-02 · `loading.tsx` / `error.tsx` en solo 4 de 9 rutas · **Media** · M

**Problema.** Tienen ambos: `casos`, `casos/grabar/[sesionId]`, `ejecuciones`, `proyectos/[id]/casos`. No tienen ninguno: `espacios`, `credenciales`, `usuarios`, `perfil`, `proyectos`.

**Impacto.** Pantalla en blanco mientras carga, y errores que suben al boundary global en vez de mostrarse en contexto.

**Solución propuesta / cómo implementarlo.** Replicar el patrón de `casos/loading.tsx` y `ejecuciones/error.tsx` (los componentes `Skeleton`, `TableSkeleton` y `ErrorState` ya existen).

---

<a id="fe-03"></a>
### FE-03 · `alert()` / `confirm()` nativos en 10 lugares · **Media** · M

**Problema.** `casos-client.tsx:77,80`, `proyecto-grid.tsx:70`, `proyectos-client.tsx:69,72`, `perfil-client.tsx:40`, `sesiones-recuperables-client.tsx:93`, `detener-button.tsx:31`, `ejecutar-button.tsx:29`, `re-run-button.tsx:24`. `casos-client.tsx` usa `ConfirmDialog` para confirmar el borrado y `alert()` para el error **del mismo flujo**.

**Impacto.** Rompen el manejo de foco, ignoran el sistema de diseño y bloquean el hilo principal.

**Solución propuesta / cómo implementarlo.** `ConfirmDialog` para confirmaciones; un aviso de error en línea (como en el resto de formularios) para errores.

---

<a id="fe-04"></a>
### FE-04 · `EjecutarCasoButton` huérfano, con dos bugs latentes · **Baja** · S

**Problema.** `components/ejecuciones/ejecutar-button.tsx` no se importa en ningún lado. Además: usa `bg-[--client]`, una variable CSS que no existe en `globals.css`; y su `catch` solo reacciona al error de ejecución en curso, tragando cualquier otro (red, 500).

**Solución propuesta / cómo implementarlo.** Borrarlo. Si se quiere reactivar, corregir antes ambos bugs.

---

<a id="fe-05"></a>
### FE-05 · El home del dashboard no tiene `<h1>` · **Baja** · S

**Problema.** `app/(dashboard)/page.tsx:77` empieza en `<h2>`; el resto de páginas usa `PageHeader`, que emite `<h1>`.

**Solución propuesta / cómo implementarlo.** Usar `PageHeader` también en el home.

---

<a id="fe-06"></a>
### FE-06 · Clase de Tailwind inexistente · **Baja** · S

**Problema.** `components/ui/kpi-tile.tsx:85` usa `media-reduced-motion:group-hover:translate-y-0`; esa variante no existe (la real es `motion-reduce:`) y no está definida en `tailwind.config.ts`. La intención igual se cumple gracias a la regla global de `app/globals.css:244-251`.

**Solución propuesta / cómo implementarlo.** Borrar la clase (es redundante) o corregirla a `motion-reduce:`.

---

<a id="fe-07"></a>
### FE-07 · Contraste de color sin verificar · **Baja** · S

**Problema.** No se validó el contraste de los tokens M3 con una herramienta de medición.

**Solución propuesta / cómo implementarlo.** Pasar axe o Lighthouse sobre las pantallas principales en modo claro y oscuro, y ajustar tokens que no cumplan WCAG AA.

---

## 11. Dependencias

<a id="dep-01"></a>
### DEP-01 · 9 vulnerabilidades adicionales en `vortest-web` · **Alta** · S · ✔

**Problema.** Además de las críticas de `next` ([SEG-04](#seg-04)), `npm audit` reporta 7 altas, 1 moderada y 1 baja: `prisma`/`@prisma/config`/`deepmerge-ts` (agotamiento de pila), `js-yaml` (CPU sin límite), `nanoid` (bucle infinito), `postcss` (XSS y *path traversal*), `sharp` (CVE heredados de `libvips`), `dompurify` vía `monaco-editor` (4 bypasses de sanitización). **Todas tienen corrección sin salto de mayor.**

**Impacto.** `dompurify` es relevante: sanitiza contenido en el editor de scripts.

**Solución propuesta / cómo implementarlo.** `npm audit fix` (sin `--force`) en la misma pasada de [SEG-04](#seg-04); después `typecheck` y `build`. Es la acción de mejor relación costo/beneficio de todo el documento.

---

<a id="dep-02"></a>
### DEP-02 · 23 vulnerabilidades en `vortest-engine` · **Media** · L

**Problema.** 10 altas, 9 moderadas, 4 bajas, 0 críticas. La mayoría está en la cadena de `@nestjs/cli` (herramienta de compilación: `ajv`, `glob`, `webpack`, `tmp`) y en `@nestjs/platform-express` (`lodash`, `multer`, `body-parser`, `qs`). Casi todas requieren NestJS 12. Solo `file-type` y `qs` se corrigen sin salto.

**Impacto.** Moderado en la práctica: `@nestjs/cli` no llega a la imagen final (el multi-stage lo poda), y los vectores de `multer` requieren endpoints de subida de archivos que el motor no tiene. Aun así, `lodash` y `qs` sí corren en producción.

**Solución propuesta / cómo implementarlo.** Aplicar ya las correcciones menores (`file-type`, `qs`) y resolver el resto con el upgrade a NestJS 12 de [DEP-03](#dep-03).

---

<a id="dep-03"></a>
### DEP-03 · Versiones mayores desactualizadas · **Media** · XL

**Problema.**

| Paquete | Actual | Última | Proyecto |
|---|---|---|---|
| `next` | 15.5.22 | 16.3.6 | web |
| `prisma` / `@prisma/client` | 6.19.3 | 7.10.0 | web |
| `@nestjs/*` | 10.4.22 | 12.x | engine |
| `tailwindcss` | 3.4.19 | 4.3.3 | web |
| `typescript` | 5.9.3 | 7.0.2 | ambos |

**Impacto.** No es un bug activo, pero cada mes el salto es más caro, y ya bloquea [DEP-02](#dep-02). Next 16 y NestJS 12 traen cambios incompatibles; Tailwind 4 cambia por completo el sistema de configuración (afecta toda la capa de tokens M3).

**Solución propuesta / cómo implementarlo.** Un *spike* por upgrade, nunca dos a la vez, en este orden: Prisma (mejor con la base aún chica) → NestJS 12 (resuelve [DEP-02](#dep-02)) → Next 16 → Tailwind 4 al final.

---

<a id="dep-04"></a>
### DEP-04 · Dependencias sin uso · **Baja** · S

**Problema.** `@dnd-kit/core`, `@dnd-kit/sortable` y `@dnd-kit/utilities` están en `vortest-web` sin ningún uso (búsqueda exhaustiva). `vortest-engine` declara `axios` directo, pero solo usa `@nestjs/axios`, que ya lo trae. Y `amqp-connection-manager` está instalado sin usar (se resuelve al hacer [FIA-04](#fia-04)).

**Solución propuesta / cómo implementarlo.** Quitarlas, o documentar por qué se mantienen si hay una funcionalidad planificada.

---

<a id="dep-05"></a>
### DEP-05 · El CI no ejecuta `npm audit` · **Media** · S

**Problema.** `.github/workflows/ci.yml` corre typecheck, tests y lint, pero no `npm audit`. Dependabot está configurado, pero no bloquea nada.

**Impacto.** La RCE crítica de [SEG-04](#seg-04) no la habría detectado el CI.

**Solución propuesta / cómo implementarlo.** Un paso `npm audit --omit=dev --audit-level=high` por proyecto (fallando en altas y críticas de dependencias de producción).

---

## 12. Configuración, variables de entorno y secretos

> Positivo verificado: los 3 `.env.example` están sincronizados con todos los `process.env.*` del código (búsqueda exhaustiva, sin desfases), y el motor valida su entorno al arrancar con Joi.

<a id="cfg-01"></a>
### CFG-01 · `lib/env.ts` existe, pero nadie lo importa · **Media** · M

**Problema.** `vortest-web/lib/env.ts` define un esquema `zod` correcto que coincide con las 15 variables de `.env.example`. Pero su propio comentario dice *"A PROPÓSITO todavía no lo importa nadie"*, no existe `instrumentation.ts`, y más de 20 sitios siguen leyendo `process.env.X` directamente (`lib/auth.ts:14`, `lib/credenciales/crypto.ts:22`, `lib/queue/rabbitmq.ts:45`, `scripts/execution-consumer.ts:33`, `scripts/recorder-worker.ts:141-154`, entre otros).

**Impacto.** Un `SESSION_SECRET` ausente o corto, o un `RABBITMQ_URL` faltante, no se detecta al arrancar: explota en medio de la petición de un usuario. El trabajo está hecho a medias: el esquema existe y no tiene efecto.

**Solución propuesta / cómo implementarlo.**
1. Crear `vortest-web/instrumentation.ts` que importe `lib/env.ts` (Next.js lo ejecuta al arrancar el proceso web).
2. Importarlo también al inicio de `scripts/execution-consumer.ts` y `scripts/recorder-worker.ts`.
3. Reemplazar progresivamente `process.env.X` por `env.X`, que además queda tipado.

---

<a id="cfg-02"></a>
### CFG-02 · `execution-consumer` sin health check · **Baja** · S

**Problema.** En el compose, `web`, `engine` y `recorder` tienen `healthcheck`; `execution-consumer` no, porque no expone HTTP.

**Impacto.** Si el consumidor se cuelga (por ejemplo, por [FIA-04](#fia-04)), nada lo detecta.

**Solución propuesta / cómo implementarlo.** Un `GET /health` mínimo en `execution-consumer.ts` que responda 503 si el canal de RabbitMQ no está activo, y su `healthcheck` en el compose.

---

<a id="cfg-03"></a>
### CFG-03 · El `Makefile` no funciona en Windows sin herramientas extra · **Baja** · S

**Problema.** El equipo desarrolla en Windows; `make` no es nativo ahí, y el target `dev` usa sintaxis de shell POSIX (`( cmd ) &`, continuación de línea) que no corre en PowerShell.

**Solución propuesta / cómo implementarlo.** Documentar el requisito (Git Bash o WSL) en el README, o agregar scripts equivalentes en `package.json` o un `.ps1`.

---

## 13. Docker e infraestructura

> Muchas mejoras de Docker ya quedaron aplicadas en el árbol de trabajo (ver [§17](#17-ya-resuelto-en-el-árbol-de-trabajo)). Lo que sigue es lo pendiente. S3 queda fuera por estar ya planificado como la siguiente fase.

<a id="inf-01"></a>
### INF-01 · Ningún contenedor tiene límites de recursos · **Alta** · S · ✔

**Problema.** `docker-compose.dev.yml` no tiene ni un `limits:` en ningún servicio.

**Impacto.** Con [FIA-02](#fia-02) sin corregir, el motor puede consumir toda la RAM de la máquina y arrastrar consigo a Postgres, RabbitMQ y la web. Es el gap operativo más urgente que sigue abierto.

**Solución propuesta / cómo implementarlo.**
```yaml
engine:
  deploy:
    resources:
      limits:       { cpus: '4.0', memory: 6G }
      reservations: { cpus: '1.0', memory: 2G }
```
Dimensionar midiendo (~300-500 MB por Chromium), **coherente con `ENGINE_MAX_CONCURRENT_JOBS`**: si no, el límite mata el proceso justo cuando hay más trabajo. Aplicar también a Postgres y RabbitMQ.

---

<a id="inf-02"></a>
### INF-02 · Sin configuración de producción; CI/CD incompleto · **Media** · XL

**Problema.** Solo existe el compose de desarrollo. El CI ya cubre typecheck, tests y lint, pero no construye ni publica imágenes, no despliega, y `prisma migrate deploy` se ejecuta dentro del `command:` del servicio `web`.

**Impacto.** No hay camino repetible a producción. Con varias réplicas web, todas intentarían migrar la base al mismo tiempo.

**Solución propuesta / cómo implementarlo.** Por etapas: (1) construir y publicar imágenes etiquetadas con SHA y versión semántica —nunca `latest` en producción—; (2) job de despliegue; (3) `prisma migrate deploy` como paso explícito del pipeline, **antes** de levantar la nueva versión; (4) compose o manifiestos de producción con política de reinicio, límites y secretos gestionados.

---

<a id="inf-03"></a>
### INF-03 · Puertos internos publicados; la cola permite ejecutar código · **Media** · S

**Problema.** El compose publica al host el puerto 3001 del motor, 3100 del grabador y 5672/15672 de RabbitMQ. Y por diseño, **quien pueda publicar en `engine.execute` ejecuta código arbitrario en el motor**: el `scriptText` del mensaje se ejecuta tal cual.

**Impacto.** Aceptable en desarrollo local. Si el compose se reutiliza como base de un despliegue expuesto, la cola de jobs equivale a un acceso remoto.

**Solución propuesta / cómo implementarlo.** En cualquier configuración no local: sin `ports:` para `engine`, `recorder` y `rabbitmq` (solo red interna); panel de administración de RabbitMQ nunca expuesto; usuarios de RabbitMQ distintos por servicio con permisos mínimos (la web publica en `engine.execute`, el motor consume de ahí y publica en `engine.events`).

---

<a id="inf-04"></a>
### INF-04 · Secretos como variables de entorno en texto plano · **Media** · M

**Problema.** Los secretos ahora son obligatorios (bien), pero siguen siendo variables de entorno leídas de un `.env` en el disco del host: visibles con `docker inspect` y en volcados de error.

**Solución propuesta / cómo implementarlo.** Docker secrets (montados en `/run/secrets/`, con el patrón `_FILE` en la aplicación) o un gestor externo (Vault, AWS/GCP Secrets Manager) en producción. Documentar la rotación — resolviendo antes [SEG-12](#seg-12), que hoy hace imposible rotar `SESSION_SECRET` sin perder datos.

---

<a id="inf-05"></a>
### INF-05 · Postgres sin backups, sin pooling y con credenciales triviales · **Media** · M

**Problema.** Un contenedor `postgres:16-alpine` con `vortest`/`vortest`, sin backups ni *connection pooling*.

**Impacto.** Sin backup probado, cualquier incidente es pérdida total. Y con tres procesos Node (web, consumidor, grabador) —más réplicas a futuro— se agota `max_connections`.

**Solución propuesta / cómo implementarlo.** (1) Backups con recuperación a un punto en el tiempo (`pgBackRest` o `wal-g`) **con restauración probada** — lo primero de esta lista; (2) PgBouncer en modo transacción (`pgbouncer=true` en la URL de Prisma); (3) credenciales reales y usuario sin privilegios de superusuario; (4) evaluar un Postgres gestionado, que para un equipo de este tamaño suele salir más barato que operarlo.

---

<a id="inf-06"></a>
### INF-06 · Sin política de retención de datos · **Media** · M

**Problema.** No hay limpieza de `storage/artefactos/` ni de las filas de `Ejecucion` / `PasoEjecucion` / `PasoSubaccion`. Solo se purgan las sesiones del grabador.

**Impacto.** Crecimiento monótono de disco y base. Migrar a S3 no lo resuelve: solo traslada el problema a una factura mensual.

**Solución propuesta / cómo implementarlo.** Primero la **decisión de negocio** (posiblemente contractual): cuánto tiempo se conserva la evidencia, y si cambia cuando el Acta se entregó al cliente. Luego un job programado que aplique esa política, sin borrar nunca artefactos referenciados por un Acta salvo que la política lo indique. Con S3, se traduce en *lifecycle rules*.

---

<a id="inf-07"></a>
### INF-07 · Sin proxy inverso ni TLS · **Media** · M

**Problema.** La web publica el puerto 3000 directo, sin TLS ni límite de tasa en el borde.

**Solución propuesta / cómo implementarlo.** Caddy (certificados automáticos) o Traefik delante: TLS y redirección a HTTPS, las cabeceras de [SEG-11](#seg-11), rate limiting en el borde como complemento de [SEG-05](#seg-05), y un único punto de entrada al host.

---

<a id="inf-08"></a>
### INF-08 · `Dockerfile.slim` incluye devDependencies · **Baja** · S

**Problema.** `vortest-web/Dockerfile.slim` copia todo `/app` a la etapa final, incluidas `tsx`, `typescript` y `tailwindcss`. Es una desviación **documentada en el propio archivo**: el compose de desarrollo ejecuta `next dev` y `node --import tsx`, que las necesitan.

**Solución propuesta / cómo implementarlo.** Correcto para desarrollo. Para producción ([INF-02](#inf-02)), una etapa final con `npm ci --omit=dev` y la salida `standalone` de Next.

---

<a id="inf-09"></a>
### INF-09 · Endurecimiento de contenedores incompleto · **Baja** · M

**Problema.** Usuario no-root y `tini` ya están resueltos. Faltan `read_only`, `cap_drop`, `no-new-privileges`, escaneo de imágenes y fijación por *digest*.

**Solución propuesta / cómo implementarlo.** `cap_drop: [ALL]` y `security_opt: [no-new-privileges:true]` en todos; `read_only: true` + `tmpfs` donde no se escriba en disco; Trivy en el CI (la imagen de Playwright acumula CVE de sistema); imágenes base fijadas por `@sha256:` además del tag.

---

<a id="inf-10"></a>
### INF-10 · Sin estrategia de escalado del motor · **Baja** · L

**Problema.** El motor es el único componente con carga intrínsecamente variable, y hoy es una sola instancia.

**Solución propuesta / cómo implementarlo.** Requisito previo: [FIA-06](#fia-06) (sin él, escalar empeora las cosas). Luego réplicas del servicio con consumidores en competencia; en Kubernetes, autoescalado por profundidad de cola con KEDA. Métrica para dimensionar: tiempo de espera en cola (p95).

---

## 14. Logging y trazabilidad

> Positivo verificado: la correlación por `jobId`/`ejecucionId` está presente y es consistente en ambos proyectos; una búsqueda dirigida no encontró volcados de sesión, credenciales, contraseñas ni `storageState` en los logs.

<a id="log-01"></a>
### LOG-01 · Logging sin estructura y sin `traceId` · **Media** · M

**Problema.** `vortest-web` tiene alrededor de 100 llamadas a `console.*` con texto interpolado; el motor usa `Logger` de Nest, también con texto. Sin JSON ni campos estructurados, y sin un identificador que siga una acción del usuario a través de los 4 procesos.

**Impacto.** Diagnosticar "esta ejecución se quedó pegada" requiere buscar a mano en tres contenedores y cruzar marcas de tiempo.

**Solución propuesta / cómo implementarlo.** `pino` en ambos (`nestjs-pino` en el motor), con campos `{ servicio, jobId, ejecucionId, proyectoId, usuarioId, traceId }`. Generar el `traceId` en la petición HTTP y propagarlo en el mensaje de la cola. Centralizar con Grafana Loki (liviano) o un servicio gestionado.

---

<a id="log-02"></a>
### LOG-02 · Sin métricas ni alertas · **Media** · M

**Problema.** Ningún `/metrics`; ni Prometheus ni OpenTelemetry en ninguno de los proyectos.

**Impacto.** Casi todos los problemas de la sección 3 son triviales de detectar con una métrica y casi invisibles sin ella: hoy dependen de que alguien note una fila rara en la UI.

**Solución propuesta / cómo implementarlo.** `prom-client` en ambos, con un mínimo inicial: jobs activos, duración de job por estado, total de jobs por estado, profundidad de cola (RabbitMQ lo expone nativamente), fallos de subida de artefactos, ejecuciones recuperadas por el watchdog y uso de disco. Alertas en Alertmanager para: ejecuciones colgadas > 0, cola creciendo sostenidamente, tasa de `errorMotor` alta, disco > 80 %, motor caído.

---

<a id="log-03"></a>
### LOG-03 · Sin rastreo de errores · **Baja** · S

**Problema.** Los errores solo existen en los logs de cada contenedor; el frontend no reporta ninguno.

**Solución propuesta / cómo implementarlo.** `@sentry/nextjs` (cubre servidor y cliente) y `@sentry/node` en el motor, con `jobId`/`ejecucionId` como contexto. Alternativa autoalojada: GlitchTip.

---

<a id="log-04"></a>
### LOG-04 · `console.*` sueltos en el motor · **Baja** · S

**Problema.** `vortest-engine/src/execution/runner.ts` tiene 7 `console.*`, mientras el resto del motor usa `Logger`. La causa es técnica (no es una clase inyectable), pero rompe la uniformidad del formato y los niveles.

**Solución propuesta / cómo implementarlo.** Instanciar `new Logger('Runner')` en el módulo, o pasarle el logger como parámetro.

---

<a id="log-05"></a>
### LOG-05 · ~100 `console.*` sin revisión completa de datos sensibles · **Baja** · M

**Problema.** La búsqueda dirigida sobre los patrones de mayor riesgo no encontró fugas, pero no se revisaron una a una las ~100 llamadas de `vortest-web`.

**Solución propuesta / cómo implementarlo.** Revisión manual completa al migrar a `pino` ([LOG-01](#log-01)), con redacción automática de campos sensibles (`redact: ['*.password', '*.storageState', …]`).

---

## 15. Documentación

<a id="doc-01"></a>
### DOC-01 · Comentario del motor que describe una arquitectura que ya no existe · **Media** · S

**Problema.** `vortest-engine/src/main.ts:15-19` dice *"todavía no hay ningún @MessagePattern/@EventPattern escuchando (eso lo agrega Parte 2 con QueueModule)"*. `QueueModule` ya existe y está importado en `app.module.ts`.

**Impacto.** Vive en el punto de entrada del servicio: es lo primero que lee quien quiere entender el arranque, y le da información falsa sobre qué está conectado.

**Solución propuesta / cómo implementarlo.** Reescribir el comentario con el estado real. (El `TODO(part2)` de `health.controller.ts` sí sigue vigente: ver [FIA-14](#fia-14).)

---

<a id="doc-02"></a>
### DOC-02 · Documentos históricos de `openspec/` sin marca de archivado · **Baja** · S

**Problema.** El encabezado *"ARCHIVADO — no refleja la arquitectura actual"* se agregó a 6 documentos de `sdd/`, pero no a `vortest-web/openspec/changes/archive/` (632 KB, la mayor parte) ni a `sdd/hu1-2-…` y `sdd/hu2-3-…`. Varios describen `scripts/worker.ts`, `lib/worker/runner.ts` y `my-reporter.js` en `vortest-web`.

**Impacto.** Cualquier persona —o agente— puede tomarlos como descripción del sistema actual.

**Solución propuesta / cómo implementarlo.** Completar el encabezado en todas las carpetas históricas, o moverlas a una wiki fuera del repositorio de código.

---

<a id="doc-03"></a>
### DOC-03 · `CLAUDE.md` menciona `components.json`, ya borrado · **Baja** · S

**Problema.** `vortest-web/CLAUDE.md` dice *"despite some leftover shadcn config files (`components.json`)"*, pero el archivo se borró.

**Solución propuesta / cómo implementarlo.** Actualizar la frase: el sistema de diseño es M3 propio y no queda configuración de shadcn.

---

## 16. Plan de ejecución sugerido

Ordenado por relación impacto/esfuerzo, no solo por prioridad.

**Ola 0 — Base (horas).** Versionar el árbol de trabajo ([§0](#0-estado-del-repositorio--leer-antes-que-nada)).

**Ola 1 — Contención (1-2 días).** Casi todo `S`; cierra las fugas de datos, la RCE y los bugs que destruyen estado.
[SEG-04](#seg-04) + [DEP-01](#dep-01) (`npm audit fix`) · [SEG-01](#seg-01) · [SEG-02](#seg-02) · [SEG-03](#seg-03) · [FIA-01](#fia-01) · [FIA-02](#fia-02) + [INF-01](#inf-01) · [FIA-05](#fia-05) · [REN-01](#ren-01) · [PW-01](#pw-01) · [PW-02](#pw-02)

**Ola 2 — Red de seguridad (3-5 días).** Sin esto, la ola 1 se erosiona con el tiempo.
[FIA-03](#fia-03) · [FIA-04](#fia-04) · [CFG-01](#cfg-01) · [DEP-05](#dep-05) · [FIA-14](#fia-14) · [FIA-10](#fia-10) + [FIA-06](#fia-06) (juntos, por la advertencia de `PRECONDITION_FAILED`) · [SEG-05](#seg-05) · [DOC-01](#doc-01)

**Ola 3 — Decisiones de producto (requieren definición antes de implementar).**
[PW-03](#pw-03) (¿se completa la auto-reparación o se retira el contador?) · [PW-04](#pw-04) (¿multi-navegador real o solo en grabación?) · [PW-05](#pw-05) · [DUP-02](#dup-02) (¿"Pasó" o "Conforme"?) · [INF-06](#inf-06) (retención) · [SEG-03](#seg-03) (política de credenciales)

**Ola 4 — Robustez y mantenibilidad (1-2 semanas).**
[FIA-07](#fia-07) · [FIA-08](#fia-08) · [FIA-09](#fia-09) · [EST-02](#est-02) · [DUP-03](#dup-03) + [ERR-01](#err-01) + [ERR-04](#err-04) · [DUP-01](#dup-01) · [SEG-06](#seg-06)–[SEG-11](#seg-11) · [PW-06](#pw-06)–[PW-09](#pw-09) · [LOG-01](#log-01) · [LOG-02](#log-02)

**Ola 5 — Escala y deuda de fondo.**
[REN-02](#ren-02) · [FE-01](#fe-01)–[FE-03](#fe-03) · [EST-01](#est-01) · [EST-03](#est-03) · [SEG-12](#seg-12) · [DEP-03](#dep-03) (un upgrade a la vez) · [INF-02](#inf-02)–[INF-07](#inf-07) · resto de prioridad baja

---

## 17. Ya resuelto en el árbol de trabajo

Aplicado por el intento de corrección anterior y verificado en esta auditoría como **correcto y completo** (pendiente de versionar — ver [§0](#0-estado-del-repositorio--leer-antes-que-nada)):

| Hallazgo anterior | Qué se hizo |
|---|---|
| Versión de Playwright desalineada | `@playwright/test` fijado exacto en `1.62.1` en `package.json`, *lockfile* y `node_modules` de ambos proyectos, igual al tag de ambas imágenes; script `verify:playwright` en el CI |
| `vortest-engine` sin `.dockerignore` (`.env` horneado en la imagen) | `.dockerignore` creado; excluye `.env*` salvo `.env.example` |
| `RECORDER_INTERNAL_SECRET` con valor por defecto público | Obligatorio (`:?`) como los demás secretos |
| RabbitMQ con `guest/guest` | Credenciales obligatorias por variable; `RABBITMQ_URL` actualizadas |
| Node como PID 1 sin init | `tini` como `ENTRYPOINT` en el motor |
| Contenedores como root | `USER node` / `pwuser` con `chown` acotado |
| Imagen de Playwright en servicios que no la usan | `Dockerfile.slim` (`node:24-slim` + `openssl`) para `web` y `execution-consumer` |
| Sin multi-stage | Multi-stage real en el motor (con poda de devDependencies) |
| Health checks faltantes | `web`, `engine` y `recorder` con `healthcheck` contra endpoints reales |
| Sin CI | `.github/workflows/ci.yml` con matriz por proyecto |
| Sin Dependabot | `.github/dependabot.yml` para npm, Docker y Actions |
| Sin ESLint | Configurado y funcional en ambos proyectos (informativo en CI) |
| `components.json` y `class-variance-authority` huérfanos | Eliminados |
| `SESIONES_RETENTION_DAYS` sin documentar | Documentada en `.env.example` |
| README que decían "próximamente" y "esqueleto" | Reescritos con el estado real |
| Scripts inexistentes en el README | Corregidos |
| Tabla de variables incompleta | Reemplazada por referencia a `.env.example` |
| `fixtures/` y `tsconfig.tsbuildinfo` versionados | Retirados del índice; `*.tsbuildinfo` en `.gitignore` |
| Sin comando único para el stack | `Makefile` (con la salvedad de [CFG-03](#cfg-03)) |
| Patrones de `.gitignore` anclados a la raíz antigua | Reescritos con prefijo `vortest-web/` |
| `playwright.config.ts` de la web sin uso | Eliminado; `playwright.e2e.config.ts` + script `test:e2e` |
| Encabezados de archivado | Parcial: ver [DOC-02](#doc-02) |

---

## 18. Lo que está bien hecho

Para no romperlo al aplicar lo anterior:

- **RBAC centralizado** (`lib/auth.ts`): `require*` lanza, `scope*Where` filtra en la consulta y no en la UI. El rol se relee en cada petición, así que un cambio de rol o una suspensión aplican de inmediato. De 33 endpoints, 29 lo aplican bien; los IDOR son omisiones puntuales, no fallas del patrón.
- **`updateCaso` revalida el acceso contra el proyecto destino** cuando un caso cambia de proyecto: el caso de *mass assignment* que uno esperaría encontrar roto, no lo está.
- **Las 9 rutas del grabador verifican propiedad** por `usuarioId` sin excepción.
- **Cifrado AES-256-GCM de credenciales** bien implementado (nonce aleatorio, tag verificado); su única debilidad es la clave ([SEG-12](#seg-12)).
- **`sameSite: "strict"`** en la cookie de sesión: mitigación fuerte y gratuita de CSRF.
- **`onDelete` del esquema con criterio documentado**: `Restrict` en evidencia, `Cascade` en filas hijas, coherente con el soft-delete.
- **`FOR UPDATE NOWAIT`** en `dispararEjecucion`: solución correcta a una carrera real.
- **Anti-N+1 explícito** en `getMetrics` / `getEspaciosMetrics`.
- **Guards atómicos con `updateMany` + filtro de estado** en `handleEnd` y `detenerEjecucion`: el mecanismo correcto para que un evento tardío no pise un estado terminal.
- **Timeout del runner** con SIGTERM → 5 s de gracia → SIGKILL y protección contra doble resolución.
- **Subida de artefactos** con reintentos acotados, hash en *streaming* y fallo suave (`artifactUploadFailed` en vez de romper el job); **deduplicación** por `sha256 + ejecucionId`.
- **Módulos del motor sin ciclos**, con `EventsPublisherModule` extraído deliberadamente como hoja; `@EventPattern` es la elección correcta para *fire-and-forget*.
- **Configuración de Playwright acertada en lo que importa para evidencia**: `retries: 0` (un reintento automático ocultaría fallos en un Acta), `workers: 1` coherente con un proceso por job, y **ningún `waitForTimeout` ni `networkidle`** en el código que genera o envuelve scripts.
- **`SpecBuilder`** reproduce la salida de codegen carácter por carácter, con referencia a la línea exacta del código fuente de Playwright.
- **Monaco cargado con `next/dynamic`**, y una regla global de `prefers-reduced-motion` que cubre toda la app.
- **`StatusBadge`, `PageHeader`, `Skeleton`, `ErrorState`** son componentes canónicos reales; el problema no es que falten abstracciones, sino que se adoptaron a medias.
- **Exports nombrados consistentes** (73 de 74 archivos de `components/`).
- **`.env.example` sincronizados con el código** y validación de entorno con Joi en el motor.
- **Comentarios en español que explican las decisiones no obvias** (por qué `noAck: false`, por qué no se espera a `startAllMicroservices()`, por qué el motor no monta el volumen de artefactos) — y el intento de corrección interrumpido dejó cada desviación del plan documentada con referencia al hallazgo. Esa cultura es la que permitió que esta auditoría fuera precisa.
