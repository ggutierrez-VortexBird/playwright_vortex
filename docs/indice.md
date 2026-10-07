# Documentación de vorTest

vorTest es una plataforma para automatizar pruebas web con Playwright y dejar evidencia verificable de cada ejecución. Esta página da el panorama completo y lo esencial de cada tema. Cada sección cierra con el documento de referencia por si necesitas el detalle: tablas completas, contratos, configuración.

## Contenido

1. [Qué hace vorTest](#1-qué-hace-vortest)
2. [Cómo está compuesto](#2-cómo-está-compuesto)
3. [Cómo funciona una ejecución](#3-cómo-funciona-una-ejecución)
4. [Cómo se graba un caso](#4-cómo-se-graba-un-caso)
5. [Datos](#5-datos)
6. [Usuarios y permisos](#6-usuarios-y-permisos)
7. [API e integración entre servicios](#7-api-e-integración-entre-servicios)
8. [Seguridad](#8-seguridad)
9. [Interfaz](#9-interfaz)
10. [Desarrollo](#10-desarrollo)
11. [Plan: evidencias en S3](#11-plan-evidencias-en-s3)
12. [Documentos de referencia](#12-documentos-de-referencia)

## 1. Qué hace vorTest

Un equipo de QA organiza su trabajo en **espacios** (un cliente o un área), que agrupan **proyectos** (una aplicación bajo prueba), que contienen **casos de prueba**. Cada caso es un script de Playwright, y se crea de dos formas:

- **Grabar acción**: se navega el sitio en una ventana de Playwright Codegen y vorTest convierte los clics en un script.
- **Subir script**: se carga un `.spec.ts` ya escrito.

Un caso se **ejecuta** en Chromium, Firefox o WebKit y su avance se sigue en vivo, paso a paso. Al terminar queda la **evidencia**: video con capítulos por paso, capturas y traza de Playwright. Con ella se genera el **Acta de evidencia**, un PDF con número consecutivo anual que certifica el resultado: *Conforme* o *No conforme*.

## 2. Cómo está compuesto

El repositorio tiene dos proyectos Node independientes:

- **`vortest-web`** (Next.js): la interfaz, la API, la base de datos, el grabador y el consumidor de eventos.
- **`vortest-engine`** (NestJS): el motor que ejecuta las pruebas.

Corren como cinco servicios de Docker más el grabador:

| Servicio | Qué hace | Tecnología | Puerto |
|---|---|---|---|
| `web` | Interfaz, API, permisos, PDF del Acta | Next.js 16 · React 19 · Prisma 6 | 3000 |
| `execution-consumer` | Guarda en la base el progreso que informa el motor | Node.js 24 | — |
| `engine` | Ejecuta los casos con Playwright | NestJS 12 · Playwright 1.62.1 | 3001 |
| `rabbitmq` | Colas de trabajos y de eventos | RabbitMQ 3 | 5672 · consola 15672 |
| `postgres` | Base de datos | PostgreSQL 16 | 5432 |
| grabador | Abre Codegen y transmite los pasos en vivo | Node.js 24 · Playwright | 3100 |

Una regla ordena todo: **la web decide y el motor ejecuta**. La web tiene la base de datos y los permisos; el motor no accede a la base ni guarda archivos propios. Por eso hay dos imágenes Docker:

- `node:24-slim` para la web y el consumidor, que no ejecutan pruebas;
- `mcr.microsoft.com/playwright:v1.62.1-noble`, con los tres navegadores, para el motor.

El grabador corre en la máquina del usuario y no en Docker, porque Codegen abre una ventana en su escritorio.

Para profundizar: [Componentes y tecnologías](./componentes.md) (versiones de cada biblioteca, volúmenes, variables) y [Arquitectura](./arquitectura.md) (diagramas).

## 3. Cómo funciona una ejecución

1. **Despacho.** Al dar clic en "Ejecutar", la web comprueba el permiso y bloquea el caso en la base para que no corra dos veces a la vez. Si ya hay una ejecución en curso, lleva al usuario a ella. Si no, crea la ejecución y publica un trabajo en la cola `engine.execute` con el script, el navegador elegido y, si aplica, una sesión ya iniciada.
2. **Ejecución.** El motor toma el trabajo y corre `playwright test` en un proceso aislado:
   - cada réplica atiende hasta 3 trabajos a la vez;
   - el script no ve ningún secreto del sistema;
   - lo tecleado en campos de clave sale enmascarado.
3. **Progreso.** Un reporter propio emite un evento por cada paso, acción, log y aserción. El motor los publica en la cola `engine.events`, y `execution-consumer` los guarda en la base.
4. **Evidencia.** El motor sube videos, capturas y trazas por HTTP a la web, que verifica el hash y el tamaño de cada archivo antes de aceptarlo.
5. **Resultado.** El evento final trae el resultado y los totales de aserciones. La pantalla de detalle, que consulta cada 2 s mientras la ejecución está en curso, avisa al terminar.

Además:

- **Detener.** Una ejecución se puede detener en cualquier momento. Queda "Cancelada" de inmediato, y un resultado que llegue después no la pisa.
- **Límite de tiempo.** Cada ejecución tiene 10 minutos. Si una queda colgada, el consumidor la marca como "Error del motor".
- **Caso padre.** Un caso puede depender de otro, típicamente un login. El padre corre primero; si es *Conforme*, el hijo arranca con su sesión, y si no, el hijo no se ejecuta.

Para profundizar: [Motor de ejecución](./motor-de-ejecucion.md) (contrato del trabajo, cada evento, reintentos, configuración).

## 4. Cómo se graba un caso

1. En *Casos → Nuevo caso → Grabar acción* se indican el proyecto, el nombre del caso, la URL inicial, el ambiente y el navegador. Opcionalmente se agrega una credencial o un caso padre, para empezar con una sesión iniciada.
2. La web le pide al grabador que abra Codegen. Se abre una ventana del navegador en el escritorio del usuario, con el idioma y la zona horaria configurados.
3. Cada acción aparece en vivo en la pantalla de vorTest, que recibe el script por WebSocket.
4. Al detener, la pantalla de revisión muestra:
   - el script en un editor, donde se puede corregir;
   - los pasos que se leen de él;
   - avisos de selectores frágiles.

   Desde ahí se guarda la grabación como caso, o se descarta.
5. Ya en el detalle del caso, los valores tecleados se pueden convertir en **parámetros** (`{{usuario}}`) con sus juegos de datos.

El script que escribe Codegen es la fuente de verdad del caso: lo que se ve como "pasos" es una lectura de ese script, no al revés.

Para profundizar: [Arquitectura → Grabación](./arquitectura.md#grabación).

## 5. Datos

```
Espacio → Proyecto → CasoPrueba → Ejecucion → Acta
                                      ├─ PasoEjecucion → PasoSubaccion
                                      └─ Artefacto (video, captura, traza)
```

Una ejecución pasa por estos estados, y la interfaz siempre usa las mismas etiquetas:

| Estado | Se muestra como |
|---|---|
| `pendiente` | En cola |
| `corriendo` | Ejecutando |
| `paso` | Conforme |
| `fallo` | No conforme · paso N |
| `errorMotor` | Error del motor |
| `cancelado` | Cancelada |

Otros datos clave:

- **Acta.** Una por ejecución, con consecutivo `ACE-AAAA-NNNN`. Regenerarla conserva el número, y dos pedidos simultáneos consumen uno solo.
- **Credenciales.** Son sesiones ya iniciadas de un proyecto (`storageState` de Playwright), cifradas con AES-256-GCM. Solo el superadmin las ve y las gestiona.
- **Evidencias.** Se guardan en el volumen `artefactos` de la web y se deduplican por SHA-256.
- **Migraciones.** Están versionadas y se aplican solas al arrancar la web.

Para profundizar: [Modelo de datos](./modelo-de-datos.md) (todas las entidades, reglas de borrado, índices, cómo crear una migración).

## 6. Usuarios y permisos

| Rol | Puede |
|---|---|
| **superadmin** | Todo. Es el único que crea espacios, gestiona credenciales y crea usuarios admin. |
| **admin** | Administrar los espacios que el superadmin le asignó: sus proyectos, casos, ejecuciones y testers. Crear usuarios tester. |
| **tester** | Trabajar en los proyectos que le asignaron: crear, ejecutar y revisar casos. |

Los permisos se validan siempre en el servidor: los listados se filtran por el alcance del usuario, y cada acción empieza comprobando el rol. Un usuario suspendido pierde el acceso de inmediato, aunque tenga la sesión abierta.

Para profundizar: [Arquitectura → Autorización](./arquitectura.md#autorización).

## 7. API e integración entre servicios

La interfaz habla con la web por rutas HTTP bajo `/api` (ejecuciones, casos, grabador, espacios, proyectos, usuarios, credenciales). Convenciones de todas:

- Autenticación con la cookie de sesión `vortest_session`. Sin sesión, `401`; sin permiso, `403`; fuera del alcance, `404`.
- Errores en español, sin detalles internos: `{ error, message }`.

Los servicios se comunican entre sí por cuatro canales, y solo por estos:

| Canal | Sentido | Medio |
|---|---|---|
| Trabajo | web → motor | Cola `engine.execute` |
| Progreso | motor → consumidor | Cola `engine.events` |
| Evidencias | motor → web | `POST /api/internal/artefactos/upload` |
| Cancelación | web → motor | `POST /internal/cancel/:id` |

Las rutas internas no usan sesión: se autentican con el encabezado `X-Internal-Secret`.

Para profundizar: [API](./api.md) (cada ruta con permiso y respuestas, mensajes de RabbitMQ).

## 8. Seguridad

- **Sesión.** Cookie cifrada (`iron-session`), `SameSite=Strict`.
- **Login.** Tras 5 intentos fallidos, ese email queda bloqueado 15 minutos. La redirección posterior solo acepta rutas internas.
- **Encabezados.** Política de seguridad de contenido (CSP) aplicada, sin `X-Powered-By`, y HSTS en producción.
- **Scripts.** Corren sin acceso a los secretos del sistema, y lo tecleado en campos de clave se enmascara antes de llegar a la pantalla o al Acta.
- **Credenciales.** Se cifran con una clave propia, `CREDENCIALES_ENCRYPTION_KEY`, obligatoria en producción.
- **Datos hacia el navegador.** Las sesiones de prueba y los valores de credenciales nunca llegan al navegador.
- **Trazas.** El visor de trazas se sirve desde la propia app, así que la evidencia no sale a un sitio externo.

Para profundizar: [Arquitectura → Seguridad de la plataforma](./arquitectura.md#seguridad-de-la-plataforma).

## 9. Interfaz

La interfaz es una herramienta de trabajo: densa en información y sobria.

- **Colores y temas.** Toma los colores del logo: teal para las acciones principales y ámbar como acento. Tiene tema claro y oscuro, que se elige en el menú del usuario.
- **Componentes.** Todo sale de `app/tokens.css` y de los componentes de `components/ui/`, como botones, campos con error en línea, avisos, diálogos de confirmación y estados vacíos.
- **Estados.** Un estado se muestra siempre con color, ícono y texto.
- **Accesibilidad.** Cumple WCAG 2.1 AA: contraste suficiente, foco visible, navegación completa con teclado.
- **Textos.** Español neutro con tuteo, y mensajes que dicen qué pasó y cómo seguir.

Para profundizar: [Sistema de diseño](./sistema-de-diseno.md) (tokens, catálogo de componentes, guía de textos).

## 10. Desarrollo

```bash
cp .env.example .env && make up     # los 5 servicios
make recorder                       # el grabador, en otra terminal
make test && make lint              # tests y lint de ambos proyectos
```

- **Proyectos separados.** Cada uno se instala y se prueba por su cuenta.
- **Cambios de código.** El código vive dentro de las imágenes: después de editar hay que reconstruir el servicio (`docker compose -f docker-compose.dev.yml up -d --build web`).
- **Antes de un PR.** Tienen que pasar los tipos, el lint y los tests. Además:
  - la interfaz se revisa en tema claro, en oscuro y en móvil;
  - los cambios en la base van como migración versionada;
  - los commits siguen Conventional Commits.
- **Convenciones.** Autorización primero; `select` explícito en las consultas; fechas con la zona horaria de `lib/format.ts`; ejecuciones siempre con `buildExecuteJob`.

Para profundizar: [Cómo contribuir](./contribuir.md) (convenciones completas, trampas del entorno, pruebas manuales).

## 11. Plan: evidencias en S3

Es el único cambio de arquitectura planificado. Hoy las evidencias y las actas se guardan en un volumen local de la web. El plan las mueve a S3 detrás de una capa de almacenamiento intercambiable:

- Las filas existentes se migran con verificación de hash.
- El video se podrá adelantar en cualquier punto.
- Se podrá aplicar una política de retención.
- Se podrá volver al almacenamiento local sin tocar código.

Para profundizar: [Plan: evidencias en S3](./plan-s3.md).

## 12. Documentos de referencia

| Documento | Léelo cuando necesites |
|---|---|
| [Componentes y tecnologías](./componentes.md) | La versión exacta de una biblioteca, una imagen Docker, un volumen o una variable de entorno. |
| [Arquitectura](./arquitectura.md) | Los diagramas de servicios y de secuencia, o el detalle de autorización y seguridad. |
| [Motor de ejecución](./motor-de-ejecucion.md) | Tocar el despacho, el motor o el consumidor, o depurar una ejecución. |
| [Modelo de datos](./modelo-de-datos.md) | Una entidad, un estado, una regla de borrado o crear una migración. |
| [API](./api.md) | Una ruta concreta, su permiso y sus respuestas, o el formato de un mensaje. |
| [Sistema de diseño](./sistema-de-diseno.md) | Construir o cambiar una pantalla. |
| [Cómo contribuir](./contribuir.md) | Preparar el entorno, resolver un problema del entorno o abrir un PR. |
| [Plan: evidencias en S3](./plan-s3.md) | Implementar el almacenamiento en S3. |
