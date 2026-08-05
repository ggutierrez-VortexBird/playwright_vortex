# ACTA — Historias de usuario por fase

Formato: historia + criterios de aceptación en Dado / Cuando / Entonces.

> **Nota sobre el alcance del MVP:** la vista "Grabador" del mockup (`acta-mockups.html` → pantalla 2) **es aspiracional, no parte del MVP**. El MVP trabaja sobre el archivo `.spec.ts` ya escrito por el equipo; la UI para grabar visualmente queda como fase futura. Esta nota alinea el alcance con el principio de "cargar el caso directamente, sin sistema intermedio" — la plataforma no pretende ser un IDE de Playwright.

---

## Fase 0 — Fundamentos

**HU-0.1 — Modelo de datos definido**
Como desarrollador del proyecto
Quiero tener el esquema de base de datos (espacio, proyecto, caso de prueba, ejecución, paso, artefacto, acta) implementado como migraciones de Prisma
Para que todas las fases siguientes se construyan sobre una estructura estable.

*Criterios de aceptación:*
- Dado el esquema definido, cuando se corre la migración inicial, entonces se crean todas las tablas sin errores.
- Dado un caso de prueba, cuando se elimina el proyecto al que pertenece, entonces la relación queda protegida o en cascada según se defina explícitamente (no queda huérfano por accidente).
- Dado el esquema, cuando se revisa, entonces cada tabla tiene los campos mínimos descritos en el modelo de datos del plan (sin campos pendientes de definir).

**HU-0.2 — Convención de registro del script de Playwright**
Como desarrollador del proyecto
Quiero tener documentado y validado cómo se registra el script/endpoint de Playwright de un caso de prueba (ruta, formato, ubicación en disco)
Para que la carga de casos en la Fase 2 tenga una única forma de hacerse, sin ambigüedad.

*Criterios de aceptación:*
- Dado un archivo `.spec.ts` de ejemplo, cuando se sigue la convención documentada, entonces el worker puede localizarlo y ejecutarlo sin configuración adicional.
- Dado un intento de registrar un caso con una ruta inválida o inexistente, entonces el sistema debe poder detectarlo (aunque la validación en UI se implemente en la Fase 2).

---

## Fase 1 — Esqueleto del proyecto y Docker de desarrollo

**HU-1.1 — Inicio de sesión**
Como usuario superadministrador
Quiero iniciar sesión con mi correo y contraseña
Para acceder de forma segura a la plataforma y que nadie más pueda entrar sin credenciales.

*Criterios de aceptación:*
- Dado que ingreso credenciales correctas, cuando envío el formulario, entonces accedo al panel principal.
- Dado que ingreso una contraseña incorrecta, cuando envío el formulario, entonces veo un mensaje de error y permanezco en el login.
- Dado que no he iniciado sesión, cuando intento acceder a cualquier ruta de la plataforma, entonces soy redirigido al login.
- Dado que cierro sesión, cuando intento volver a una página protegida, entonces se me pide iniciar sesión de nuevo.

**HU-1.2 — Entorno de desarrollo reproducible**
Como desarrollador del proyecto
Quiero levantar Postgres con `docker-compose.dev.yml` y correr la app en local contra esa base de datos
Para tener un entorno de desarrollo consistente sin instalar Postgres manualmente.

*Criterios de aceptación:*
- Dado el repositorio recién clonado, cuando corro `docker compose -f docker-compose.dev.yml up` y luego `npm run dev`, entonces la app conecta a la base de datos sin pasos manuales adicionales.
- Dado que reinicio el contenedor de Postgres, cuando vuelvo a levantarlo, entonces los datos previos siguen ahí (volumen persistente).

---

## Fase 2 — Jerarquía empresa → proyecto → caso de prueba

**HU-2.1 — Crear espacio de empresa**
Como usuario superadministrador
Quiero crear un espacio de empresa con nombre y color identificador
Para empezar a organizar el trabajo de un cliente nuevo.

*Criterios de aceptación:*
- Dado que completo el nombre del espacio, cuando guardo, entonces el espacio aparece en el listado principal.
- Dado que intento crear un espacio sin nombre, cuando guardo, entonces veo un error de validación y no se crea el registro.
- Dado un espacio ya creado, cuando lo edito y cambio su nombre o color, entonces el cambio se refleja en el listado y en la navegación.

**HU-2.2 — Crear proyecto dentro de un espacio**
Como usuario superadministrador
Quiero crear un proyecto dentro de un espacio de empresa, indicando su nombre y ambiente
Para agrupar los casos de prueba correspondientes a esa iniciativa.

*Criterios de aceptación:*
- Dado que estoy dentro de un espacio, cuando creo un proyecto, entonces el proyecto queda asociado únicamente a ese espacio.
- Dado un proyecto creado, cuando lo consulto, entonces veo cuántos casos de prueba tiene (0 si es nuevo).
- Dado que intento eliminar un espacio con proyectos activos, entonces el sistema me advierte antes de permitirlo (no se borra en cascada de forma silenciosa).
- Dado que estoy dentro de un espacio, cuando consulto la grilla de proyectos, entonces cada proyecto se muestra en una tarjeta con: nombre del espacio (chip), nombre del proyecto, ambiente, conteo total de casos, conteo de casos conformes en su última ejecución, conteo de casos no conformes en su última ejecución y fecha de la última ejecución.

**HU-2.3 — Registrar caso de prueba con su script de Playwright**
Como usuario superadministrador
Quiero registrar un caso de prueba dentro de un proyecto, asociándolo directamente a su script/endpoint de Playwright, con un código de referencia y un responsable
Para tener un catálogo ordenado de mis pruebas sin pasar por un sistema intermedio que las traduzca.

*Criterios de aceptación:*
- Dado que completo código, nombre, script asociado y responsable, cuando guardo, entonces el caso aparece en el listado del proyecto con estado "sin ejecuciones".
- Dado que el script indicado no existe o no es accesible, cuando intento guardar, entonces veo un error explícito antes de que el caso quede registrado.
- Dado un código de caso ya usado en el mismo proyecto, cuando intento registrar otro caso con ese mismo código, entonces el sistema lo rechaza (el código es único por proyecto).

**HU-2.4 — Ver listado de casos de prueba de un proyecto**
Como usuario superadministrador
Quiero ver el listado de casos de prueba de un proyecto con su código, responsable, resultado de la última ejecución y fecha
Para saber de un vistazo el estado general de las pruebas de ese proyecto.

*Criterios de aceptación:*
- Dado un proyecto con casos que nunca se han ejecutado, cuando veo el listado, entonces esos casos muestran un estado neutro ("sin ejecutar"), no un falso "pasó" o "falló".
- Dado un proyecto con casos ya ejecutados, cuando veo el listado, entonces cada caso muestra el resultado y la fecha de su ejecución más reciente.

**HU-2.5 — Identidad visual del espacio en toda la UI**
Como usuario superadministrador
Quiero que el color de cada espacio de empresa sea visible y consistente en toda la interfaz (sidebar, switcher, scope-bar, tarjeta de proyecto, acta)
Para distinguir visualmente de un vistazo a qué cliente pertenece cada pantalla y reducir el riesgo de ejecutar contra el cliente equivocado.

*Criterios de aceptación:*
- Dado un espacio con color definido, cuando navego por la plataforma con ese espacio activo, entonces el color aparece en: la franja vertical del sidebar, el marcador del switcher, el ícono de scope-bar y el borde superior de la tarjeta de proyecto.
- Dado que cambio el color del espacio, cuando guardo, entonces en menos de una navegación el cambio ya se refleja en todos los puntos visuales donde aparece.

**HU-2.6 — Cambiar el proyecto activo desde el sidebar**
Como usuario superadministrador
Quiero un switcher en el sidebar para saltar rápidamente entre proyectos activos de cualquier espacio
Para no tener que pasar siempre por la grilla de "Proyectos" cuando ya sé a cuál quiero ir.

*Criterios de aceptación:*
- Dado que tengo más de un proyecto creado, cuando abro el switcher del sidebar, entonces veo la lista de proyectos recientes o favoritos con su nombre, espacio y color asociado.
- Dado que selecciono un proyecto del switcher, cuando confirmo, entonces la navegación cambia al contexto del nuevo proyecto (scope-bar, casos, ejecuciones) sin recargar la página completa.
- Dado que solo existe un proyecto creado, cuando abro el switcher, entonces funciona como un encabezado estático sin lista desplegable.

**HU-2.7 — Contexto activo visible en todas las vistas internas**
Como usuario superadministrador
Quiero ver siempre el cliente·proyecto activo en la parte superior de las vistas internas (casos, ejecuciones, credenciales)
Para saber en todo momento en qué contexto estoy trabajando sin revisar la URL ni el sidebar.

*Criterios de aceptación:*
- Dado que estoy dentro de un proyecto, cuando abro casos, ejecuciones, una ejecución individual, un acta o credenciales, entonces el scope-bar muestra "Cliente · Proyecto" con el color del espacio.
- Dado que no hay proyecto activo (estoy en la grilla de proyectos), cuando abro cualquier vista, entonces el scope-bar no aparece (la pantalla no muestra contexto porque está en el nivel superior).

---

## Fase 3 — Motor de ejecución

**HU-3.1 — Disparar la ejecución de un caso de prueba**
Como usuario superadministrador
Quiero disparar la ejecución de un caso de prueba desde un botón en la plataforma
Para correr la prueba real sin usar la interfaz nativa de Playwright.

*Criterios de aceptación:*
- Dado un caso de prueba registrado, cuando presiono "ejecutar", entonces se crea una ejecución en estado "pendiente" y la petición responde de inmediato (sin esperar a que termine la prueba).
- Dado que la ejecución pasa a "corriendo", cuando actualizo la vista, entonces veo el estado cambiar sin recargar manualmente.
- Dado que la ejecución termina, cuando reviso su estado, entonces refleja correctamente "pasó" o "falló" según el resultado real de Playwright.

**HU-3.2 — Evitar ejecuciones simultáneas del mismo caso**
Como usuario superadministrador
Quiero que no se puedan correr dos ejecuciones del mismo caso de prueba al mismo tiempo
Para evitar resultados inconsistentes o conflictos sobre el mismo entorno.

*Criterios de aceptación:*
- Dado un caso de prueba con una ejecución en curso, cuando intento dispararlo de nuevo, entonces el sistema me impide crear una segunda ejecución y me indica que ya hay una en curso.
- Dado que la ejecución en curso termina (con éxito o error), cuando intento ejecutar de nuevo, entonces el sistema lo permite sin restricciones.

**HU-3.3 — Manejo de fallas del propio motor de ejecución**
Como usuario superadministrador
Quiero que si el motor de ejecución falla por una causa ajena a la prueba (por ejemplo el script no se encuentra), la ejecución quede marcada con un estado claro y distinto a "falló por la prueba"
Para poder diferenciar un error de infraestructura de un error real de la prueba.

*Criterios de aceptación:*
- Dado que el script asociado al caso no existe al momento de ejecutar, cuando el worker lo intenta correr, entonces la ejecución queda en un estado de error de motor (no "falló"), con un mensaje explicativo.
- Dado ese estado de error, cuando reviso el detalle de la ejecución, entonces no aparecen pasos falsos de la prueba (porque nunca llegó a correr).

**HU-3.4 — Stream en vivo de pasos durante la ejecución**
Como usuario superadministrador
Quiero ver cada paso agregarse al detalle de la ejecución en el mismo momento en que termina, mientras la prueba corre
Para entender el progreso real de la ejecución sin tener que esperar a que termine.

*Criterios de aceptación:*
- Dado que una ejecución está corriendo, cuando un paso termina, entonces aparece en la vista de detalle sin que yo tenga que recargar la página.
- Dado un paso recién agregado, cuando lo veo, entonces se distingue visualmente como "recién agregado" durante unos segundos (no se confunde con el resto del historial de la ejecución).
- Dado que la ejecución terminó, cuando consulto el detalle después, entonces el orden y contenido de los pasos refleja exactamente lo que se emitió durante la corrida (no se "rellena" información que no fue reportada).

---

## Fase 4 — Vista de ejecución y evidencia

**HU-4.1 — Ver el detalle paso a paso de una ejecución**
Como usuario superadministrador
Quiero ver el detalle de una ejecución con cada paso, su resultado y su duración
Para entender exactamente qué pasó durante la prueba sin revisar logs crudos.

*Criterios de aceptación:*
- Dado una ejecución finalizada, cuando abro su detalle, entonces veo la lista de pasos en el orden en que ocurrieron, cada uno con su resultado (pasó/falló/reparado) y duración.
- Dado un paso que falló, cuando lo reviso, entonces veo el motivo del fallo reportado por Playwright.

**HU-4.2 — Revisar video y capturas de una ejecución**
Como usuario superadministrador
Quiero reproducir el video y ver las capturas de una ejecución directamente desde la web
Para verificar visualmente el comportamiento de la prueba sin salir de la plataforma ni descargar archivos sueltos.

*Criterios de aceptación:*
- Dado una ejecución con artefactos generados, cuando abro su detalle, entonces puedo reproducir el video sin descargarlo aparte.
- Dado una ejecución con capturas por paso, cuando reviso un paso específico, entonces veo la captura correspondiente a ese paso (no todas mezcladas).
- Dado una ejecución que aún no tiene artefactos disponibles (en curso), cuando abro su detalle, entonces la plataforma lo indica claramente en vez de mostrar un espacio vacío o un error.
- Dado que el video de una ejecución muestra varios pasos, cuando lo reproduzco en la plataforma, entonces aparecen anotaciones de capítulo sobre la línea de tiempo (uno por paso), indicando en qué punto del video ocurre cada paso del acta.

**HU-4.3 — Identificar pasos con self-healing**
Como usuario superadministrador
Quiero identificar cuándo un paso fue reparado automáticamente (self-healing)
Para saber si un caso de prueba necesita revisión aunque haya "pasado" en general.

*Criterios de aceptación:*
- Dado un paso donde el selector original falló y se usó un respaldo, cuando reviso la ejecución, entonces ese paso se marca visualmente distinto a un paso que pasó sin incidentes.
- Dado una ejecución con al menos un paso reparado, cuando veo el resumen general de la ejecución, entonces el resultado global lo refleja (no queda oculto dentro del detalle de un solo paso).

**HU-4.4 — Ver trace de Playwright de una ejecución**
Como usuario superadministrador
Quiero abrir el trace `.zip` de Playwright generado por una ejecución desde la propia plataforma
Para depurar el comportamiento de la prueba sin descargar archivos sueltos.

*Criterios de aceptación:*
- Dado que una ejecución terminó y se generó su trace, cuando hago clic en "ver trace" desde el detalle de la ejecución, entonces se abre el visor de Playwright (servido por la propia web o vía `trace.playwright.dev`) mostrando timeline, acciones, DOM y capturas.
- Dado un trace cargado en el visor, cuando navego por sus acciones, entonces puedo identificar en qué paso y contra qué selector ocurrió cada interacción.
- Dado que la ejecución no generó trace (por ejemplo, error de motor antes de arrancar), cuando hago clic en "ver trace", entonces se me indica de forma clara que no hay trace disponible y por qué.

---

## Fase 5 — Acta de evidencia

**HU-5.1 — Generación automática del acta**
Como usuario superadministrador
Quiero que cada ejecución finalizada genere automáticamente un acta con sus metadatos y resultados
Para tener evidencia formal lista sin tener que armarla manualmente.

*Criterios de aceptación:*
- Dado que una ejecución termina (pase o falle), cuando reviso el proyecto, entonces existe un acta asociada a esa ejecución sin acción manual de mi parte.
- Dado un acta generada, cuando la abro, entonces incluye como mínimo: ID de ejecución, caso, código REQ, ambiente, fechas de inicio/fin, resultado por paso y hash de los artefactos.
- Dado una ejecución que falló por un error del motor (no de la prueba), cuando reviso, entonces el acta lo indica explícitamente y no lo presenta como un resultado de prueba válido.
- Dado un acta generada, cuando la abro, entonces su encabezado incluye: espacio, proyecto, título "Acta de ejecución de pruebas", línea fija "Elaborada por Vortexbird S.A.S." y un sello de resultado (`Conforme` / `No conforme`).
- Dado un acta generada, cuando la abro, entonces la meta-grid incluye también la versión del sistema bajo prueba (cadena libre configurable por proyecto).
- Dado un acta finalizada, cuando consulto el bloque "Integridad de los artefactos", entonces aparece una línea por artefacto (video, capturas por paso, trace) con su nombre de archivo y su hash sha256.

**HU-5.2 — Descargar el acta en PDF**
Como usuario superadministrador
Quiero descargar el acta de una ejecución en PDF
Para poder compartirla o archivarla fuera de la plataforma.

*Criterios de aceptación:*
- Dado un acta ya generada, cuando presiono "descargar PDF", entonces obtengo un archivo con el mismo contenido y formato que la vista en pantalla.
- Dado un acta descargada, cuando la abro fuera de la plataforma, entonces sigue siendo legible y completa sin depender de la sesión activa.

**HU-5.3 — Consecutivos y códigos con formato notarial**
Como usuario superadministrador
Quiero que el caso de prueba y el acta tengan identificadores con un formato estable y trazable ("CP-XXXX-YY" y "EJC-YYYY-NNNNNN")
Para que cualquier referencia externa (auditoría, defensa ante cliente, mención en correo) apunte a un ID único, ordenado y reconocible.

*Criterios de aceptación:*
- Dado que registro un caso nuevo, cuando guardo, entonces el sistema asigna automáticamente un código con el formato `CP-XXXX-YY` (donde XXXX es el código REQ del caso e YY es un consecutivo interno por REQ).
- Dado que una ejecución finaliza, cuando se genera su acta, entonces el acta recibe el consecutivo `EJC-YYYY-NNNNNN` (YYYY año, NNNNNN correlativo anual).
- Dado un acta existente, cuando lo busco por su consecutivo, entonces la búsqueda devuelve el acta exacta en menos de 1 segundo.

---

## Fase 6 — Extensibilidad de usuarios

**HU-6.1 — Validar el modelo de permisos por espacio**
Como desarrollador del proyecto
Quiero comprobar que puedo asociar un segundo usuario de prueba a un espacio específico sin modificar el esquema de base de datos
Para confirmar que agregar usuarios en el futuro no requerirá rediseñar el modelo de datos.

*Criterios de aceptación:*
- Dado el esquema actual, cuando inserto manualmente un segundo usuario y lo asocio a un solo espacio (vía la tabla puente), entonces la relación se guarda sin errores ni cambios de esquema.
- Dado ese usuario de prueba, cuando reviso el diseño, entonces queda documentado qué falta a nivel de UI (no de modelo de datos) para habilitarlo formalmente.

---

## Fase 7 — Credenciales

**HU-7.1 — Registrar una credencial de proyecto**
Como usuario superadministrador
Quiero registrar una credencial (usuario, tipo, valor) asociada a un proyecto
Para tener a mano los accesos necesarios para las pruebas de ese proyecto.

*Criterios de aceptación:*
- Dado que completo los datos de una credencial, cuando guardo, entonces el valor se almacena cifrado en base de datos (no en texto plano).
- Dado una credencial guardada, cuando la veo en el listado de su proyecto, entonces se muestra su nombre y tipo, su estado de sesión (activa con vencimiento / requiere ingreso) y los botones "Renovar" o "Iniciar sesión", pero no su valor.
- Dado una credencial con sesión activa, cuando pasan los minutos configurados sin renovación, entonces la sesión expira y la credencial vuelve al estado "Requiere ingreso".
- Dado que dos proyectos son de clientes distintos, cuando listo las credenciales de uno, entonces ninguna credencial del otro aparece (ni como referencia, ni como opción, ni siquiera como existente — el aislamiento es total).

**HU-7.2 — No exponer contraseñas en la interfaz ni en el acta**
Como usuario superadministrador
Quiero que las credenciales nunca se muestren en texto plano en la plataforma ni en las actas
Para evitar exponer contraseñas por accidente ante quien reciba una evidencia.

*Criterios de aceptación:*
- Dado un caso de prueba que usa una credencial, cuando reviso su acta, entonces aparece una referencia a la credencial (nombre) y no su valor.
- Dado que intento consultar el valor de una credencial vía la interfaz, entonces no existe ninguna acción que lo revele en texto plano.

**HU-7.3 — Las contraseñas nunca se persisten ni se filtran en artefactos**
Como usuario superadministrador
Quiero que ningún artefacto generado por la plataforma (video, capturas, trace, logs, acta) contenga contraseñas en texto claro
Para evitar que una filtración de evidencia filtre también credenciales.

*Criterios de aceptación:*
- Dado un caso de prueba que usa una credencial con valor real, cuando reviso el video de la ejecución, entonces el valor de la contraseña no aparece (queda enmascarado al tipear).
- Dado el trace de una ejecución que autenticó contra un sistema, cuando lo abro, entonces los campos sensibles aparecen enmascarados, no en claro.
- Dado el log del worker para esa ejecución, cuando lo reviso, entonces no contiene el valor de la credencial.
- Dado el acta en PDF de esa ejecución, cuando la descargo y la abro fuera de la plataforma, entonces no incluye valores de credenciales en claro.

---

## Fase 8 — Docker de producción y despliegue

**HU-8.1 — Imagen de producción autocontenida**
Como desarrollador del proyecto
Quiero una imagen Docker de producción que incluya la app y Playwright con sus navegadores ya instalados
Para desplegar la plataforma como un solo artefacto reproducible.

*Criterios de aceptación:*
- Dado el `Dockerfile` de producción, cuando se construye la imagen, entonces `playwright test` puede correr dentro del contenedor sin instalar nada adicional en tiempo de ejecución.
- Dado el contenedor levantado, cuando se accede a la web, entonces responde igual que en desarrollo (build `standalone` funcionando).

**HU-8.2 — Conexión a base de datos externa en producción**
Como desarrollador del proyecto
Quiero que la app en producción se conecte a una base de datos Postgres externa mediante variables de entorno
Para gestionar la base de datos de forma independiente al contenedor de la aplicación.

*Criterios de aceptación:*
- Dado un `DATABASE_URL` apuntando a una Postgres externa, cuando se levanta el contenedor de producción, entonces la app conecta sin necesidad de una Postgres dentro del mismo `docker-compose.prod.yml`.
- Dado que la base de datos externa no está disponible al arrancar, cuando el contenedor intenta conectar, entonces el error queda registrado claramente en los logs (no falla en silencio).

**HU-8.3 — Persistencia de artefactos entre despliegues**
Como desarrollador del proyecto
Quiero que los artefactos de las ejecuciones (video, capturas, trace, actas) se guarden en un volumen persistente
Para que no se pierdan al reiniciar o actualizar el contenedor de la app.

*Criterios de aceptación:*
- Dado un volumen montado, cuando se reinicia o actualiza el contenedor, entonces los artefactos generados antes del reinicio siguen siendo accesibles desde la web.
- Dado el volumen definido, cuando reviso la configuración de `docker-compose.prod.yml`, entonces queda explícito qué ruta del contenedor se persiste.

---

## Fase 9 — Endurecimiento y observabilidad

**HU-9.1 — Backups periódicos**
Como desarrollador del proyecto
Quiero contar con un proceso documentado de backup de la base de datos y del volumen de artefactos
Para poder recuperar la información ante una falla o pérdida de datos.

*Criterios de aceptación:*
- Dado el proceso de backup definido, cuando se ejecuta, entonces genera un respaldo restaurable tanto de la base de datos como del volumen de artefactos.
- Dado un backup reciente, cuando se restaura en un entorno limpio, entonces la plataforma queda operativa con los datos y evidencias previas intactas.

**HU-9.2 — Logs claros del worker**
Como desarrollador del proyecto
Quiero que el proceso worker registre logs claros de cada ejecución que procesa
Para poder diagnosticar rápido cuándo una falla es del motor y no de la prueba en sí.

*Criterios de aceptación:*
- Dado que el worker procesa una ejecución, cuando reviso los logs, entonces puedo identificar el inicio, fin y resultado de esa ejecución específica.
- Dado un error del motor (no de la prueba), cuando reviso los logs, entonces el mensaje distingue claramente ese caso de un fallo normal de Playwright.
