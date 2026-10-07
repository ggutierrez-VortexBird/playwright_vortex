# vorTest

Plataforma para automatizar pruebas web con Playwright y dejar evidencia verificable de cada ejecución.

Con vorTest un equipo de QA:

- **graba** un caso de prueba navegando el sitio (Playwright Codegen) o **sube** un script `.spec.ts` existente;
- lo **ejecuta** en Chromium, Firefox o WebKit y sigue el progreso en vivo, paso a paso;
- revisa la **evidencia**: video con capítulos por paso, capturas y traza de Playwright;
- genera el **Acta de evidencia**, un PDF con consecutivo anual que deja constancia del resultado: *Conforme* o *No conforme*.

El acceso se organiza en **espacios** (clientes o áreas), que agrupan **proyectos**, que contienen **casos**. Hay tres roles: superadmin, admin de espacio y tester de proyecto.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| [`vortest-web/`](./vortest-web) | Dashboard Next.js: interfaz, API, base de datos (Prisma + PostgreSQL), grabador y consumidor de eventos. |
| [`vortest-engine/`](./vortest-engine) | Motor de ejecución NestJS: recibe trabajos por RabbitMQ, corre `playwright test` y sube la evidencia. |
| [`docs/`](./docs/indice.md) | Documentación del proyecto; empieza por `indice.md`. |

Son dos proyectos Node independientes, sin workspace: cada uno tiene su `node_modules` y su lockfile.

## Requisitos

- Docker Desktop
- Node.js 24
- Para grabar casos: los navegadores de Playwright en tu máquina (`npx playwright install`)

## Instalación

```bash
git clone https://github.com/ggutierrez-VortexBird/playwright_vortex.git
cd playwright_vortex
cp .env.example .env          # completa los secretos: el compose no arranca sin ellos
make up                       # o: docker compose -f docker-compose.dev.yml up
```

Abre <http://localhost:3000> e inicia sesión con `admin@admin.com` y la contraseña que pusiste en `SEED_ADMIN_PASSWORD`.

`make up` levanta PostgreSQL, RabbitMQ, `web`, `execution-consumer` y `engine`. Las migraciones y el usuario inicial se crean solos al arrancar `web`.

### Grabador

El grabador corre en tu máquina, no en Docker: Playwright Codegen abre una ventana del navegador en tu escritorio y ahí se hacen los clics que se graban. En otra terminal:

```bash
cd vortest-web && npm install && npx playwright install
make recorder                 # o: npm run dev:recorder:host
```

`web` lo encuentra en `host.docker.internal:3100`.

## Uso

1. Crea un **espacio** y, dentro, un **proyecto**.
2. En *Casos → Nuevo caso*, elige **Grabar acción** (navegas el sitio y se graba) o **Subir script** (un `.spec.ts` existente).
3. **Ejecútalo** y sigue el avance en el detalle de la ejecución.
4. Revisa la evidencia y **genera el Acta**.

## Comandos

```bash
make up        # levanta los 5 servicios
make down      # los detiene
make dev       # PostgreSQL y RabbitMQ en Docker; web, consumidor y grabador con npm run dev
make recorder  # grabador en tu máquina
make test      # tests de ambos proyectos
make lint      # lint de ambos proyectos
make logs      # logs de los servicios
```

Cada proyecto también se puede levantar por separado; ver [`vortest-web/README.md`](./vortest-web/README.md) y [`vortest-engine/README.md`](./vortest-engine/README.md).

## Configuración

| Archivo | Para qué |
|---|---|
| [`.env.example`](./.env.example) | Variables del compose. Copiar a `.env`. |
| [`vortest-web/.env.example`](./vortest-web/.env.example) | La web, el consumidor y el grabador sin Docker. |
| [`vortest-engine/.env.example`](./vortest-engine/.env.example) | El motor sin Docker. |

| Variable | Para qué |
|---|---|
| `SESSION_SECRET` | Firma la cookie de sesión (mínimo 32 caracteres). |
| `SEED_ADMIN_PASSWORD` | Contraseña de `admin@admin.com`. |
| `CREDENCIALES_ENCRYPTION_KEY` | Cifra las credenciales guardadas. Obligatoria en producción. |
| `RECORDER_INTERNAL_SECRET` | Secreto compartido entre la web y el grabador. |
| `ENGINE_INTERNAL_SECRET` | Secreto compartido entre la web y el motor. |
| `RABBITMQ_USER` · `RABBITMQ_PASS` | Acceso a RabbitMQ. La contraseña no puede llevar `@ / : #` ni caracteres no ASCII. |

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| Una ejecución queda "En cola" o "Ejecutando" | En orden: `rabbitmq` sano, `engine` conectado, `execution-consumer` vivo (`make logs`). |
| "No se pudo iniciar la grabación" | El grabador no está corriendo (`make recorder`). |
| El compose no arranca | Falta `.env` o un secreto obligatorio. |
| Docker Desktop no arranca | El disco virtual se llenó con imágenes de builds anteriores: `docker image prune -f && docker builder prune -f`. |

Más casos en [Cómo contribuir](./docs/contribuir.md#trampas-verificadas-del-entorno).

## Documentación

Empieza por [`docs/indice.md`](./docs/indice.md): resume cada parte del sistema y enlaza a su documento (componentes, arquitectura, motor de ejecución, modelo de datos, API, sistema de diseño y guía de contribución).

Historial de cambios: [`CHANGELOG.md`](./CHANGELOG.md).

---

Desarrollado por Vortexbird SAS.
