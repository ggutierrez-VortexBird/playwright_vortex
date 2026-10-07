# vorTest

Plataforma para automatizar pruebas web con Playwright y dejar evidencia verificable de cada ejecución.

Con vorTest un equipo de QA:

- **graba** un caso de prueba navegando el sitio (Playwright Codegen) o **sube** un script `.spec.ts` existente;
- lo **ejecuta** en Chromium, Firefox o WebKit y sigue el progreso en vivo, paso a paso;
- revisa la **evidencia**: video con capítulos por paso, capturas, traza de Playwright;
- genera el **Acta de evidencia** (PDF con consecutivo anual) para dejar constancia del resultado: *Conforme* o *No conforme*.

El acceso se organiza en **espacios** (clientes o áreas), que agrupan **proyectos**, que contienen **casos**. Hay tres roles: superadmin, admin de espacio y tester de proyecto.

## Cómo está armado

El repositorio tiene **dos proyectos Node independientes** (sin workspaces: cada uno con su `node_modules` y su lockfile):

| Carpeta | Qué es |
|---|---|
| [`vortest-web/`](./vortest-web) | Dashboard Next.js 16: interfaz, API, base de datos (Prisma + PostgreSQL), grabador y consumidor de eventos. |
| [`vortest-engine/`](./vortest-engine) | Motor de ejecución NestJS: recibe trabajos por RabbitMQ, corre `playwright test` y sube los artefactos. No toca la base de datos. |

Arquitectura, modelo de datos, API, sistema de diseño y guía de contribución: [`docs/`](./docs).

## Empezar en local

Requisitos: Docker Desktop, Node.js 24 y (para grabar) los navegadores de Playwright en tu máquina.

```bash
cp .env.example .env          # completa los secretos; el compose no arranca sin ellos
make up                       # o: docker compose -f docker-compose.dev.yml up
```

Abre <http://localhost:3000> e inicia sesión con `admin@admin.com` y la contraseña que pusiste en `SEED_ADMIN_PASSWORD`.

Eso levanta PostgreSQL, RabbitMQ, `web`, `execution-consumer` y `engine`. Las migraciones se aplican solas al arrancar `web`.

### Grabar casos

El grabador corre **en tu máquina, no en Docker**: Playwright Codegen abre una ventana real del navegador y ahí se hacen los clics que se graban; un contenedor no tiene pantalla donde mostrarla. En otra terminal:

```bash
cd vortest-web && npm install && npx playwright install
make recorder                 # o: npm run dev:recorder:host
```

`web` lo encuentra en `host.docker.internal:3100`.

### Comandos

```bash
make up        # docker compose up (5 servicios)
make down
make dev       # PostgreSQL y RabbitMQ en Docker; web, consumidor y grabador con npm run dev
make recorder  # grabador en el host
make test      # tests de ambos proyectos
make lint      # lint de ambos proyectos
make logs
```

Cada proyecto también se puede levantar por separado: ver su `README.md`.

## Variables de entorno

| Archivo | Para qué |
|---|---|
| [`.env.example`](./.env.example) | Lo que interpola `docker-compose.dev.yml`. Copiar a `.env`. |
| [`vortest-web/.env.example`](./vortest-web/.env.example) | `npm run dev` de la web, el consumidor y el grabador sin Docker. |
| [`vortest-engine/.env.example`](./vortest-engine/.env.example) | El motor sin Docker. |

En producción `CREDENCIALES_ENCRYPTION_KEY` es obligatoria (cifra las sesiones guardadas como credenciales).

## Si algo no anda

| Síntoma | Qué revisar |
|---|---|
| Una ejecución queda "En cola" o "Ejecutando" | En orden: `rabbitmq` sano, `engine` conectado, `execution-consumer` vivo (`make logs`). Casi nunca es la web. |
| "No se pudo iniciar la grabación" | El grabador del host no está corriendo (`make recorder`). |
| El compose no arranca | Falta `.env` o un secreto obligatorio dentro de él. |
| Docker Desktop no arranca | El disco virtual se llenó con imágenes de rebuilds: `docker image prune -f && docker builder prune -f`. |

Más trampas verificadas del entorno de desarrollo en [`docs/contribuir.md`](./docs/contribuir.md).

## Estado

- Sin despliegue de producción definido: el compose de la raíz es de desarrollo.
- Sin cola de mensajes muertos en RabbitMQ: un trabajo que agota sus reintentos se descarta (ver [`docs/arquitectura.md`](./docs/arquitectura.md#límites-conocidos)).
- Cambios: [`CHANGELOG.md`](./CHANGELOG.md). Auditoría de calidad y su seguimiento: [`AUDIT.md`](./AUDIT.md).

---

Desarrollado por Vortexbird SAS.
