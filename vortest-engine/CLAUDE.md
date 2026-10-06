# CLAUDE.md

Jamas hacer commit ni push ni nada que tenga que ver con git a menos de que el prompt lo pida explícitamente.
Jamas arregles test a menos de que te lo pida explícitamente.

## What this is

`vortest-engine` — el motor de ejecución de Playwright de vorTest, extraído como servicio NestJS independiente (`feature/separacion-monolito`). Es uno de dos proyectos independientes en este repo (ver `../README.md` y `../vortest-web/CLAUDE.md` para el otro, el dashboard Next.js).

**Sin acceso a base de datos, por diseño.** Recibe trabajos ya preparados (script completo como texto, con hooks/auto-reparación ya inyectados por `vortest-web`), los ejecuta con `playwright test` como child process, y reporta todo hacia afuera — nunca escribe directamente en Postgres.

## Comunicación con `vortest-web`

- **Entrada** (`vortest-web` → acá): job de ejecución vía RabbitMQ, cola `engine.execute`, formato `ExecuteJobMessage` (`src/queue/execute-job.message.ts`). NestJS envuelve automáticamente el mensaje como `{pattern, data}` (`ClientProxy` RMQ) — `vortest-web` debe replicar ese envoltorio al publicar/consumir o el mensaje se descarta en silencio.
- **Salida** (acá → `vortest-web`): eventos de progreso/resultado vía RabbitMQ, cola `engine.events`, envueltos en `EngineEvent<T>` (`src/queue/events.publisher.ts`) — tipos env/step/substep/log/assertion/captura-test/end, casi 1:1 con el reporter NDJSON original.
- **Artefactos** (acá → `vortest-web`, HTTP directo, NO por la cola): `POST {MAIN_APP_INTERNAL_URL}/api/internal/artefactos/upload`, header `X-Internal-Secret`, multipart streamed. El `end` event trae el array `artefactos[]` con los `artefactoId` ya creados por esa subida, para que `vortest-web` haga el linking a `PasoEjecucion`/`PasoSubaccion`.
- **Cancelación** (`vortest-web` → acá, HTTP directo): `POST /internal/cancel/:jobId`, mismo header. `200 {cancelled:true}` si este reemplazo tenía el job, `404 {cancelled:false}` si no (benigno con múltiples réplicas).

No se emite evento `end` para jobs cancelados — `vortest-web` ya marca `estado: 'cancelado'` de forma optimista al llamar `/internal/cancel`, independiente de lo que responda el motor.

## Comandos

```bash
npm install
npm run build
npm run start:dev     # boot local, requiere RABBITMQ_URL/ENGINE_INTERNAL_SECRET/MAIN_APP_INTERNAL_URL en .env
npm run typecheck
npm test
```

Ver `docker-compose.dev.yml` en la raíz del repo para levantar esto junto con `rabbitmq`, `postgres` y `web`.

## Gaps conocidos (Fase 1)

- Sin dead-letter queue configurada en RabbitMQ (config de infra, no de aplicación).
- Cancelación y encadenamiento padre/hijo no probados en vivo contra una instancia real (solo unit tests con mocks) más allá de un smoke test manual de ejecución simple.
