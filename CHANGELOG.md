# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las referencias entre corchetes (SEG-01, UX-02…) son hallazgos de [`AUDIT.md`](./AUDIT.md).

## [Sin publicar] — Auditoría de calidad (rama `feature/auditoria-ux`)

### Agregado
- **Credenciales**: la pantalla deja de ser "Próximamente". El superadmin lista, agrega (pegando o cargando el `storageState`, validado y cifrado) y elimina credenciales, viendo cuántos casos dependen de cada una [UX-12].
- **Ejecución en vivo**: cronómetro, aviso al terminar con el resultado, estado en el título de la pestaña, aviso de conexión perdida o sesión vencida [UX-02, BUG-06].
- **Filtros de ejecuciones**: un buscador y chips por estado con totales reales de la base [UX-05].
- **Visor de evidencias** con la captura completa, zoom y descarga [UX-04].
- **Pasos en vivo** mientras se graba [UX-09].
- **Tema oscuro** con selector Claro · Oscuro · Sistema [UI-10].
- **Migas** Espacio › Proyecto › Caso › Ejecución y título propio en cada pestaña [UX-06, UX-07].
- **Tabla de casos** ordenable y con columna Proyecto [UX-10].
- Avisos (toasts) al crear, guardar y eliminar en todas las pantallas [UX-11].
- Documentación en [`docs/`](./docs): arquitectura, modelo de datos, API, sistema de diseño y guía de contribución [DOC-01].

### Cambiado
- **Identidad**: la paleta sale del logo (teal `#135C65` y ámbar `#EEAA0B`); los títulos van en tinta y el teal queda para lo accionable. Tokens en un solo archivo (`app/tokens.css`) [UI-01, UI-02].
- **Vocabulario de resultados único**: "Conforme / No conforme", "En cola", "Ejecutando", "Error del motor", "Cancelada", siempre con ícono además del color [UI-04, UI-05].
- Componentes base nuevos (Button con carga, Field, Alert, Toast, Card, Tabs, Spinner) en lugar de copias por pantalla [UI-06].
- Formularios (login, casos, proyectos, espacios, usuarios, credenciales, perfil y grabación): error en línea, foco al primer error y aviso antes de cerrar con cambios sin guardar [UX-08].
- En móvil las migas muestran sólo la ubicación actual; la tabla de casos indica "Página 1 de 2" [UX-07, UX-10].
- "Detener" confirma con el diálogo de la app en vez del `window.confirm` del navegador [UX-03].
- La 404 y las pantallas de error explican qué pasó en español, con código de soporte y salidas claras [UI-08, UX-01].
- Textos en español neutro (sin voseo ni jerga técnica) [UX-13].
- El inicio calcula sus indicadores sobre todas las ejecuciones, no sobre las últimas 20 [BUG-15].
- La API responde 400 ante un cuerpo que no es JSON (en todas las rutas) y 403 ante falta de permisos (antes 500) [BUG-12, BUG-13].
- `npm run lint` vuelve a funcionar (`eslint .`, configuración de Next 16): 0 errores en web y motor [COD-01, COD-02].

### Corregido
- Un mismo caso podía ejecutarse dos veces en paralelo; ahora la segunda solicitud responde 409 con enlace a la ejecución en curso [BUG-01].
- Doble clic en "Ejecutar" lanzaba dos ejecuciones o abría otra ejecución distinta [BUG-11].
- Artefactos de más de 10 MB llegaban cortados; dos `video.webm` de la misma ejecución se pisaban [BUG-02, BUG-10].
- El watchdog podía pisar un resultado recién llegado; un evento repetido podía lanzar dos veces el caso hijo; un evento que siempre fallaba bloqueaba la cola [BUG-07, BUG-08].
- Dos "Guardar" del grabador creaban dos casos; dos "Generar acta" gastaban dos consecutivos [BUG-16].
- "Guardar como caso" en la revisión recargaba la página y descartaba lo editado [BUG-04].
- Eliminar un espacio o proyecto que fallaba no mostraba nada [BUG-14].
- El aviso de cambios sin guardar del perfil nunca aparecía [BUG-18].
- Las migraciones no se versionaban: un clon limpio no podía crear la base [BUG-03].

### Seguridad
- El script de un caso ya no recibe las variables de entorno del motor (`RABBITMQ_URL`, `ENGINE_INTERNAL_SECRET`) [SEG-01].
- El listado de ejecuciones enviaba al navegador el `storageState` (cookies del sitio bajo prueba) y el script [SEG-02].
- Límite de intentos de login por email, no por la IP que manda el cliente [SEG-03]; `from` del login sólo acepta rutas internas [SEG-04].
- Un admin ya no puede suspender usuarios fuera de sus espacios [SEG-05].
- Lo tecleado en campos de clave se enmascara antes de llegar a la interfaz y al Acta [SEG-06].
- Las respuestas ya no incluyen mensajes de Prisma o Chromium ni rutas del servidor [SEG-07].
- `CREDENCIALES_ENCRYPTION_KEY` documentada y obligatoria en producción [SEG-08].
- CSP aplicada (antes sólo en modo reporte), sin `X-Powered-By`, HSTS en producción [SEG-09].
- El grabador sólo acepta un `wsUrl` que apunte al grabador configurado [SEG-10].

### Rendimiento
- Métricas de proyectos en lote: 2 consultas en vez de 2 por proyecto [REN-01].
- Fuentes con `next/font`, sin la hoja de Google Fonts que bloqueaba el render [REN-02].
- Índices para el listado, la última ejecución por caso y el watchdog; se quitan los redundantes [REN-03].

### Eliminado
- Restos de la auto-reparación (estado `reparado`, columnas `selfHealed` y `selectoresRespaldo`) [migración `20261006230000`].
- Componentes sin uso y dependencias sin uso (`@dnd-kit/*`, `ts-jest`, `@eslint/eslintrc`; en el motor `joi`, `@standard-schema/spec`, `@nestjs/testing`) [COD-03, COD-04].

### Cambios de lógica de negocio y su motivo
- **Concurrencia por caso**: antes el bloqueo `FOR UPDATE NOWAIT` no bloqueaba ninguna fila y dejaba correr el mismo caso dos veces (comprobado en vivo). Ahora se toma un lock por caso dentro de la transacción. El comportamiento esperado por el negocio (una ejecución en curso por caso) no cambia: ahora se cumple.
- **Concurrencia del motor**: `ENGINE_MAX_CONCURRENT_JOBS` (3 por defecto) limita cuántos `playwright test` corren a la vez en una réplica, para no saturar el contenedor.
- **Límite de login por email**: un atacante ya no puede esquivarlo cambiando el encabezado `X-Forwarded-For`; como contrapartida, cinco intentos fallidos contra un email bloquean ese email 15 minutos aunque vengan de equipos distintos.
- **Credenciales**: eliminar una credencial hace que los casos grabados con ella se ejecuten sin esa sesión; la confirmación lo advierte con el número de casos afectados.
- **Integridad de artefactos**: una subida cuyo SHA-256 o tamaño no coincide se rechaza (antes se guardaba).

### Tests que este trabajo deja obsoletos (no se modificaron tests)
Comparado contra la base (`44eb443`): 89 tests ya fallaban antes; estos 15 empiezan a fallar por cambios deliberados y documentan el comportamiento anterior:
- `detener-button.test.tsx` (8): esperan `window.confirm`, reemplazado por `ConfirmDialog` [UX-03].
- `lib/ejecuciones/actions.test.ts` (2): esperan `FOR UPDATE NOWAIT` / P2024, el mecanismo que permitía la doble ejecución [BUG-01].
- `upload/route.test.ts` (3): mandan hashes ficticios que ahora se rechazan por integridad [BUG-02, BUG-10].
- `caso-table.test.tsx` (1): espera la etiqueta "Pasó"; ahora es "Conforme" [UI-04].
- `parametros/[paramId]/route.test.ts` (1): su título dice "retorna 403" pero espera que la ruta lance (lo que producía un 500); ahora devuelve 403 [BUG-13].

## [Fase 1] — Separación del motor (rama `feature/separacion-monolito`)

### Cambiado
- El motor de Playwright sale de la web a `vortest-engine` (NestJS), comunicado por RabbitMQ y HTTP interno, sin acceso a la base de datos.
- El grabador corre en el host del usuario (Codegen necesita pantalla); `web` lo llama en `host.docker.internal:3100`.

### Corregido
- Navegador obligatorio en cada trabajo (sin él el caso corría en los tres navegadores).
- El caso padre del grabador se despacha por la cola (antes quedaba pendiente para siempre).
- Fechas con zona horaria explícita (errores de hidratación y horas en UTC en el Acta).
- Idioma y zona horaria del navegador del grabador alineados con el motor.
