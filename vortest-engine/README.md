# vortest-engine

Motor de ejecución de Playwright de VorTest. Corre como servicio NestJS
independiente de `vortest-web`: recibe trabajos de ejecución despachados por
RabbitMQ (`engine.execute`), corre el script de Playwright, emite eventos de
progreso/resultado (`engine.events`) y sube artefactos (video, capturas) por
HTTP interno a `vortest-web`. **Cero acceso a base de datos** — no conoce
Prisma, no sabe qué es un `CasoPrueba` ni una `Ejecucion`, solo ejecuta
scripts y reporta.

> Estado actual: **motor completo e implementado**, no un scaffolding. Recibe
> jobs por RabbitMQ, spawnea `playwright test` como proceso hijo, reporta
> eventos estructurados (env/step/substep/log/assertion/end) y sube
> artefactos por HTTP — todo conectado y en uso en `docker-compose.dev.yml`.
> Gaps conocidos, vigentes (no bloqueantes para correr en local): sin
> dead-letter queue de RabbitMQ configurada para `engine.execute`, y
> cancelación/encadenamiento padre-hijo probados con tests unitarios
> (mocks), no en vivo contra una instancia real de punta a punta.

## Cómo correrlo en local (sin Docker)

```bash
npm install
cp .env.example .env   # y ajustar RABBITMQ_URL / ENGINE_INTERNAL_SECRET / MAIN_APP_INTERNAL_URL
npm run start:dev
```

Esto expone `GET http://localhost:3001/health` → `{ "status": "ok" }`.

Si `RABBITMQ_URL` no apunta a un broker real (p. ej. RabbitMQ no está
levantado), el proceso **no crashea**: loggea el error de conexión y sigue
sirviendo el lado HTTP normalmente — ver el `try/catch` alrededor de
`startAllMicroservices()` en `src/main.ts`.

## Cómo correrlo vía Docker

Este servicio se levanta como parte del `docker-compose.dev.yml` de la raíz
del repo, junto con `vortest-web`, `postgres` y `rabbitmq` — ya está
configurado ahí (servicio `engine`), no requiere ningún paso adicional:

```bash
cd ..
docker compose -f docker-compose.dev.yml up
```

También se puede buildear standalone:

```bash
docker build -t vortest-engine .
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `RABBITMQ_URL` | Conexión AMQP al broker (colas `engine.execute` / `engine.events`). En `docker-compose.dev.yml` incluye credenciales (`RABBITMQ_USER`/`RABBITMQ_PASS` de la raíz del repo), no `guest/guest`. |
| `ENGINE_INTERNAL_SECRET` | Secreto compartido con `vortest-web` para los endpoints internos motor↔app (mismo valor en ambos lados) |
| `MAIN_APP_INTERNAL_URL` | URL interna de `vortest-web`, para subir artefactos por HTTP |
| `PORT` | Puerto del servidor HTTP interno de este servicio (default `3001`) |

Ver también [`.env.example`](./.env.example), que trae estas mismas
variables documentadas inline.

Todas se validan al arranque vía `ConfigModule` (Joi) — si falta alguna
requerida, el proceso falla rápido en vez de arrancar a medias.
