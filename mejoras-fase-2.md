# Plan de ejecución — mejoras Fase 2 (pase de código sin commits)

> Documento de trabajo. NO se commitea. Trazabilidad de las decisiones tomadas con el usuario esta sesión (21-23 Sep 2026) y la secuencia de implementación.

## Decisiones (en orden de conversación)

| # | Decisión | Acción |
|---|---|---|
| 1 | **No va a existir ninguna auto-reparación**. Quitar HU-G15 y todas las menciones documentales. | Borrar `lib/worker/auto-repair.ts` + tests; quitar `selectoresRespaldo`, `selfHealed`, `Reparado` del esquema, motor y UI; borrar `TRY_WITH_REPARACION_SOURCE` y toda referencia documental. |
| 2 | **Vocabulario de estado unificado**: "Conforme / No conforme" en TODA la app. Sacar `Reparado` (consistente con 1). | Unificar `lib/ejecuciones/estado.ts` con `CONFORME / NO_CONFORME`; eliminar `REPARADO` del schema, motor y UI. |
| 3 | **Multi-navegador real**. | Propagar `navegador` desde `SesionGrabacion` hasta `ExecuteJobMessage`; declarar 3 `projects` en `playwright.config.ts`; pasar `--project=${navegador}` en el spawn. |
| 4 | **Trace en fallos**. | `trace: 'retain-on-failure'` en config; recolectar `.zip` como `tipo: 'trace'`; enlace en UI a `trace.playwright.dev`. Si la versión de `@playwright/test` no soporta `trace`, usar `@ts-expect-error` con comentario. |
| 5 | **Paginador numerado**. | `skip + take` + UI `< 1 2 3 >` en `/ejecuciones`. |
| 6 | **Tests IDOR críticos**. | Mocks actualizados + 1 test por ruta con guard nuevo, simulando usuario de otro proyecto y verificando 403. |
| 7 | **Watchdog (colgadas)**. | `setInterval(60s)` en `scripts/execution-consumer.ts` que marca `errorMotor` las `Ejecucion` en `corriendo` con `inicioAt < now - (EJECUCION_TIMEOUT_MS + GRACE)`. |
| 8 | **`/ready` real (motor)**. | Usar `@nestjs/axios` SI es necesario, o los eventos `connect`/`disconnect` internos del cliente RMQ de Nest, manteniendo un flag en memoria. |
| 9 | **Versiones mayores** (en orden): Prisma 7 → NestJS 12 → Next 16 → Tailwind 4 → TS 7. | Validar `typecheck` + `test` entre cada uno. Revertir si rompe. |
| 10 | **Dockerfile.slim se queda**. | Sin cambios. |

**No en este pase** (diferido explícito):
- Cifrado v2 con `CREDENCIALES_ENCRYPTION_KEY` y recifrado.
- Refactor de subcarpetas.
- `git add`/commit del motor (lo hacés vos).
- Infra de producción (S3, secrets, TLS, backups, proxy).
- Comando único de dev.
- `/ready` 503 si requiere librería nueva.

## Reglas del pase

- Sin commits. Sin `git add`. Sin git op de escritura.
- `npm install` SOLO para resolver puntos 8 y 9. Cualquier otra instalación requiere pedirlo.
- Tests ajenos al cambio: reportar, no arreglar.
- Cualquier rollback documentado en este archivo.

## Secuencia (para no perder contexto)

1. **Setup**: `git status`, comprobar rama limpia en `feature/separacion-monolito`.
2. **1 + 2** (auto-reparación + vocabulario) — un solo paso porque se complementan.
3. **3** (multi-navegador).
4. **4** (trace).
5. **5** (paginador).
6. **6** (tests IDOR) — modificar solo los archivos de test necesarios.
7. **7** (watchdog) — `execution-consumer.ts`.
8. **8** (`/ready` real del motor).
9. **9** — upgrades mayores, **uno por uno** con validación:
   - Prisma 7 → validar.
   - NestJS 12 → validar.
   - Next 16 → validar.
   - Tailwind 4 → validar.
   - TS 7 → validar.
10. Verificación final: typecheck + tests + lint.

Después de cada paso importante: medir (líneas cambiadas, tests que pasan ahora, tests que rompen).

## Notas

- **Multi-navegador**: la imagen del motor ya trae los 3 binarios (la imagen base Playwright los incluye). Sin dependencias nuevas.
- **Trace**: requiere `pwuser` (no root) para escribir `.zip`; hoy `vortest-engine` ya corre como `pwuser` en el Dockerfile actual. Si el type del config rechaza `trace`, aplicar `@ts-expect-error` con comentario que diga "actualizar `@playwright/test` para soportar `trace` nativamente".
- **Paginador**: el conteo total puede ser inexacto sin `count()` extra (caro a gran escala); usar `findMany` con `take: 1` extra para detectar "¿hay más?" o contar por separado si el equipo decide que hace falta.
- **Watchdog**: el `EJECUCION_TIMEOUT_MS` ya está en `.env`. Crear una const `EJECUCION_TIMEOUT_MS` y `EJECUCION_WATCHDOG_GRACE_MS` (default `2 * 60_000`).
- **`/ready`**: si los eventos internos no lo permiten sin librería, instalo `@nestjs/axios` que NO es estrictamente necesaria — uso el patrón "servicio que guarda estado desde los eventos de la conexión" sin más.

## Cambios que esperan al usuario

- `vortest-engine/` sin versionar en git: queda pendiente el `git add` y commit cuando llegue el momento.
- Revertir Prisma 7 o NestJS 12 si rompe (lo intento en orden y reverto al primer fallo).
