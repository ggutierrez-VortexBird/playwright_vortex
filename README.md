# VorTest

Plataforma de automatización de pruebas con Playwright.

Este repositorio contiene **dos proyectos Node independientes** (sin workspaces —
cada uno tiene su propio `node_modules`/lockfile y se instala/builda por separado):

| Carpeta | Qué es |
|---|---|
| [`vortest-web/`](./vortest-web) | Dashboard Next.js (UI + API + Server Actions + base de datos). Ver [`vortest-web/README.md`](./vortest-web/README.md). |
| [`vortest-engine/`](./vortest-engine) | Motor de ejecución de Playwright, servicio NestJS independiente que recibe trabajos por RabbitMQ y sube artefactos por HTTP interno a `vortest-web`. Sin acceso a base de datos. Ver [`vortest-engine/README.md`](./vortest-engine/README.md). |

## Levantar todo junto (Docker Compose)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up
```

Esto levanta PostgreSQL, RabbitMQ, `engine` (motor de ejecución),
`execution-consumer` (consume eventos del motor y escribe en la base) y `web`
(dashboard Next.js).

**El grabador corre en tu máquina, no en Docker:** Playwright Codegen abre una
ventana real del navegador en tu escritorio, que es donde hacés los clics que
se graban, y un contenedor no tiene pantalla que mostrar. En otra terminal:

```bash
cd vortest-web
npm run dev:recorder:host   # o `make recorder` si tenés make
```

`web` lo encuentra en `host.docker.internal:3100`. Requiere `npm install` en
`vortest-web/` y los navegadores de Playwright instalados en el host
(`npx playwright install`).

Gaps conocidos, vigentes (no bloqueantes para correr en local):
- Sin dead-letter queue de RabbitMQ configurada para `engine.execute`
  (infraestructura, ver `docker-compose.dev.yml` y el motor).
- Cancelación y encadenamiento padre/hijo de ejecuciones probados con tests
  unitarios (mocks), no en vivo contra una instancia real de punta a punta.
- No existe todavía ninguna configuración de despliegue de producción — el
  compose de esta raíz es exclusivamente de desarrollo.

## Levantar cada proyecto por separado (sin Docker)

Ver el `README.md` de cada subcarpeta — cada una documenta su propio
`npm install` / variables de entorno / comando de arranque.

## Comando único (Makefile)

```bash
make up      # docker compose up
make down    # docker compose down
make dev     # levanta postgres+rabbitmq en Docker y el resto con npm run dev
make recorder # grabador en el host (necesario para grabar con make up)
make test    # tests de ambos proyectos
make lint    # lint de ambos proyectos
make logs    # logs del compose
```

---

> Proyecto desarrollado por Vortexbird SAS.
