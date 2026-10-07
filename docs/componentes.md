# Componentes y tecnologías

Qué piezas forman vorTest, con qué se construyen y cómo se ejecutan. Las versiones salen de los `package.json` y lockfiles; los contenedores, de [`docker-compose.dev.yml`](../docker-compose.dev.yml) (proyecto Compose `vortest`).

## Servicios en ejecución

| Componente | Qué hace | Tecnología (versión) | Imagen base Docker | Imagen / contenedor | Puerto | Datos |
|---|---|---|---|---|---|---|
| **web** | Dashboard, API REST y Server Actions; autenticación, permisos, Acta en PDF. Aplica migraciones y semilla al arrancar. | Next.js 16.3.6 · React 19.3 · TypeScript 5.9 · Tailwind CSS 3.4 · Prisma 6.19 · Node.js 24 | `node:24-slim` (+ Chromium headless para el PDF) | `vortest-web` / `vortest-dev` | 3000 | volúmenes `artefactos`, `playwright-scripts` |
| **execution-consumer** | Consume los eventos del motor y escribe pasos, resultados y artefactos en la base; encadena casos padre → hijo; vigila ejecuciones colgadas. | Node.js 24 · TypeScript · `scripts/execution-consumer.ts` (mismo código que `web`) | `node:24-slim` | `vortest-execution-consumer` / `vortest-execution-consumer` | — | — |
| **engine** | Recibe trabajos, escribe el script a disco y lanza `playwright test` con un reporter propio; publica eventos y sube evidencias. **Sin acceso a la base de datos.** | NestJS 12.1 · TypeScript 6.0 · Playwright 1.62.1 · Node.js 24 | `mcr.microsoft.com/playwright:v1.62.1-noble` (+ `tini` como PID 1) | `vortest-engine` / `vortest-engine` | 3001 | — (efímero) |
| **rabbitmq** | Broker de mensajes: colas `engine.execute` (trabajos) y `engine.events` (progreso). | RabbitMQ 3 (management) | `rabbitmq:3-management-alpine` | `rabbitmq:3-management-alpine` / `vortest-rabbitmq` | 5672 · consola 15672 | volumen `rabbitmq-data` |
| **postgres** | Única base de datos relacional. | PostgreSQL 16 | `postgres:16-alpine` | `postgres:16-alpine` / `vortest-postgres` | 5432 | volumen `postgres-data` |
| **grabador** | Abre Playwright Codegen en el escritorio del usuario, emite los pasos en vivo (HTTP + WebSocket) y guarda la sesión. | Node.js 24 · Playwright 1.62.1 · `ws` 8 · `scripts/recorder-worker.ts` | **Corre en el host** (`make recorder`): Codegen abre una ventana en el escritorio del usuario. | — | 3100 | usa Postgres |

## Proyectos del repositorio

| Proyecto (carpeta) | Paquete npm | Contiene | Se ejecuta como |
|---|---|---|---|
| [`vortest-web/`](../vortest-web) | `vortest` 0.1.0 | Interfaz, API, esquema Prisma y migraciones, consumidor de eventos, grabador, plantilla del Acta | `web`, `execution-consumer` y el grabador |
| [`vortest-engine/`](../vortest-engine) | `vortest-engine` 0.1.0 | Motor de ejecución, reporter de Playwright, cliente de subida de artefactos | `engine` |
| [`docs/`](./indice.md) | — | Esta documentación (índice en `indice.md`) | — |
| raíz | — | `docker-compose.dev.yml`, `Makefile`, `.env.example`, `AUDIT.md`, `CHANGELOG.md` | Orquestación local |

Cada subproyecto es independiente: su propio `node_modules` y lockfile; no hay workspace.

## Imágenes

| Dockerfile | Base | La usan | Por qué |
|---|---|---|---|
| `vortest-web/Dockerfile.slim` | `node:24-slim` | `web`, `execution-consumer` | No ejecutan pruebas, así que no necesitan los navegadores de Playwright (sólo Chromium headless para renderizar el PDF del Acta). |
| `vortest-engine/Dockerfile` | `mcr.microsoft.com/playwright:v1.62.1-noble` | `engine` | Trae Chromium, Firefox, WebKit y sus dependencias del sistema. La versión de la imagen debe coincidir con la de `@playwright/test`. |

## Bibliotecas principales

| Área | Biblioteca (versión) | Para qué |
|---|---|---|
| Interfaz | Tailwind CSS 3.4 + tokens propios (`app/tokens.css`) | Sistema de diseño ([detalle](./sistema-de-diseno.md)) |
| Interfaz | Archivo y JetBrains Mono (`next/font`) · Material Symbols | Tipografía e íconos |
| Interfaz | Monaco Editor (`@monaco-editor/react` 4.7) · Recharts 3.10 | Editor de scripts · gráficos del inicio |
| Datos | Prisma 6.19 · PostgreSQL 16 | Acceso a datos y migraciones versionadas |
| Seguridad | iron-session 8 · bcryptjs 2.4 · AES-256-GCM (`node:crypto`) | Sesión por cookie · contraseñas · credenciales cifradas |
| Validación | zod 4.6 | Esquemas de entrada y de eventos |
| Mensajería | amqplib 0.10 · amqp-connection-manager (web 5, motor 4) | Conexión a RabbitMQ con reconexión |
| Pruebas | Playwright 1.62.1 (web y motor, misma versión) | Ejecución y grabación |
| Calidad | Jest 29 · Testing Library · ESLint (web 9, motor 10) · axe-core 4.13 | Tests, lint, accesibilidad |

## Volúmenes

| Volumen | Servicio | Contenido |
|---|---|---|
| `postgres-data` | postgres | Base de datos |
| `rabbitmq-data` | rabbitmq | Colas persistentes |
| `artefactos` | web, execution-consumer | Videos, capturas y trazas (`/app/storage/artefactos`) y PDF de actas. El motor **no** lo monta. |
| `playwright-scripts` | web | Scripts de Playwright |

## Variables que enlazan los componentes

| Variable | Une | Para qué |
|---|---|---|
| `RABBITMQ_URL` | web · consumer · engine → rabbitmq | Cola de trabajos y eventos |
| `ENGINE_INTERNAL_SECRET` | web ↔ engine | Subida de artefactos y cancelación |
| `ENGINE_INTERNAL_URL` | web → engine | Dónde cancelar una ejecución |
| `MAIN_APP_INTERNAL_URL` | engine → web | Dónde subir los artefactos |
| `RECORDER_INTERNAL_URL` · `RECORDER_INTERNAL_SECRET` | web → grabador | Iniciar una grabación (`host.docker.internal:3100`) |
| `DATABASE_URL` | web · consumer · grabador → postgres | Conexión a la base |
| `SESSION_SECRET` · `CREDENCIALES_ENCRYPTION_KEY` | web | Sesión y cifrado de credenciales |

La lista completa con valores de ejemplo está en los `.env.example` ([raíz](../.env.example), [web](../vortest-web/.env.example), [motor](../vortest-engine/.env.example)). El flujo entre estos componentes se explica en [arquitectura](./arquitectura.md).
