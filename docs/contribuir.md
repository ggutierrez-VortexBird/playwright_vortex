# Cómo contribuir

## Preparar el entorno

```bash
cp .env.example .env
make up                                   # PostgreSQL, RabbitMQ, web, consumidor y motor
cd vortest-web && npm install && npx playwright install
make recorder                             # grabador en el host, para grabar casos
```

Cada proyecto se instala y se prueba por separado (no hay workspace):

```bash
cd vortest-web    && npm install && npm run typecheck && npm run lint && npm test
cd vortest-engine && npm install && npm run typecheck && npm run lint && npm test
```

Otros comandos útiles de `vortest-web`:

```bash
npm run db:studio          # Prisma Studio para inspeccionar la base
npm run cleanup:sesiones   # borra sesiones de grabación viejas en estado terminal
npm run test:e2e           # pruebas e2e (con la app corriendo en localhost:3000)
```

Las e2e usan su propia configuración (`playwright.e2e.config.ts`); `BASE_URL` cambia la dirección de la app.

## Antes de abrir un PR

- `npm run typecheck` y `npm run lint` sin errores en el proyecto que tocaste (las advertencias se pueden quedar, los errores no).
- `npm test` en verde en ambos proyectos. Si un cambio deliberado deja obsoleto un test, se actualiza en el mismo PR explicando el motivo.
- Si cambiaste la interfaz, revisarla en tema claro y oscuro, en escritorio y a 390 px de ancho, y sólo con teclado.
- Si tocaste la base: migración versionada en `vortest-web/prisma/migrations/` (ver [modelo de datos](./modelo-de-datos.md#migraciones)). Nunca una migración que pierda datos sin aprobación explícita.
- Commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat`, `fix`, `refactor`, `docs`, `style`, `perf`, `test`, `chore`. Un bloque lógico por commit.
- Actualizar [`CHANGELOG.md`](../CHANGELOG.md) cuando el cambio se note para quien usa la app.

## Convenciones del código

- **Autorización primero**: toda acción que modifica empieza con `requireSuperadmin` / `requireEspacioAdmin` / `requireProyectoAccess`; todo listado filtra con `scopeEspacioWhere` / `scopeProyectoWhere`. Nunca ocultar algo sólo en la interfaz.
- **Rutas**: `withAuth` + `mapErrorToResponse`; leer el cuerpo con `leerJson(request, esquemaZod)`. Los mensajes de error van en español, sin detalles internos.
- **Datos hacia el cliente**: `select` explícito. `storageState`, scripts de otros proyectos y valores de credenciales no viajan al navegador.
- **Interfaz**: componentes de `components/ui/` y tokens de [sistema de diseño](./sistema-de-diseno.md); nada de hex sueltos ni tamaños arbitrarios. Estados del dominio desde `lib/ejecuciones/estado.ts`.
- **Fechas**: siempre con `LOCALE` y `TIME_ZONE` de `lib/format.ts` (el servidor corre en UTC; sin zona horaria hay errores de hidratación y el Acta imprime la hora en UTC).
- **Ejecutar un caso**: con `useLanzarEjecucion` en la interfaz y `buildExecuteJob` del lado del servidor (exige `navegador`; sin él Playwright corre el caso en los tres navegadores).
- **Comentarios**: una línea, sólo cuando explican un porqué que el código no cuenta.
- **Textos**: español neutro con tuteo; "Conforme / No conforme".

## Trampas verificadas del entorno

- **El código vive dentro de las imágenes** (no hay bind mount): editar y reiniciar no alcanza, hay que reconstruir: `docker compose -f docker-compose.dev.yml up -d --build web execution-consumer`.
- **Los rebuilds llenan el disco virtual de Docker** y Docker Desktop deja de arrancar con el disco lleno: `docker image prune -f && docker builder prune -f` de vez en cuando.
- **Con poca memoria el build se cae**: detener `web` antes de reconstruirlo libera la memoria que usa `next dev`.
- **`next dev` compila cada ruta la primera vez** (hasta ~20 s) y mientras tanto la página puede quedar sin hidratar: los clics no hacen nada. Al automatizar, esperar a que los botones tengan `__reactProps*`.
- **Git Bash reescribe rutas de contenedor**: `export MSYS_NO_PATHCONV=1` antes de `docker exec … /app/…`.
- **`RABBITMQ_PASS` va dentro de una URL**: `@ / : #` o caracteres no ASCII rompen la conexión (`ACCESS_REFUSED`).
- **El motor necesita `playwright.config.ts` y `scripts/` en su imagen**: `nest build` no los copia; sin ellos cada ejecución termina en "Error del motor".
- **El grabador no corre en Docker**: Codegen necesita una pantalla real.
- **Escritorio al 125 %**: para automatizar la ventana del grabador desde el sistema, el proceso tiene que declararse DPI-aware y escribir con `SendInput` Unicode.

## Pruebas manuales que conviene repetir

1. Ejecutar un caso desde la tabla: se abre el detalle, corre el cronómetro y al terminar aparece el aviso con el resultado.
2. Doble clic en "Ejecutar": una sola ejecución nueva.
3. Detener una ejecución lenta: diálogo de confirmación y estado "Cancelada".
4. Generar el Acta dos veces: mismo consecutivo.
5. Grabar un caso, revisarlo, guardarlo y ejecutarlo.
6. Iniciar sesión con un tester: sólo ve sus proyectos.
