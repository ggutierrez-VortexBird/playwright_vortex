# Especificación: Autenticación

## Propósito

Definir el comportamiento del sistema de inicio de sesión para ACTA: autenticación con correo y contraseña, protección de rutas, cierre de sesión y gestión de cookies firmadas con iron-session.

## Requisitos

### Requisito: Formulario de inicio de sesión

El sistema DEBE proveer una página en `/login` con formulario de correo y contraseña. La autenticación DEBE realizarse mediante Server Action que valide credenciales contra la tabla `usuario`.

#### Escenario: Credenciales válidas

- DADO un usuario registrado con correo y contraseña válida
- CUANDO envío el formulario con credenciales correctas
- ENTONCES el sistema crea una sesión firmada con iron-session
- Y redirige al panel principal

#### Escenario: Contraseña incorrecta

- DADO un usuario registrado
- CUANDO envío el formulario con contraseña incorrecta
- ENTONCES se muestra mensaje de error genérico ("Credenciales inválidas")
- Y permanezco en `/login` sin cookie de sesión

#### Escenario: Correo inexistente

- DADO un correo no registrado
- CUANDO envío el formulario
- ENTONCES se muestra el mismo mensaje de error genérico
- Y no se revela si el correo existe en el sistema

#### Escenario: Campos vacíos

- DADO que dejo uno o ambos campos vacíos
- CUANDO intento enviar el formulario
- ENTONCES el navegador impide el envío por validación HTML5 (`required`)

### Requisito: Protección de rutas

El sistema DEBE proteger todas las rutas internas excepto `/login`. Si no existe sesión válida, el usuario DEBE ser redirigido a `/login`. La URL solicitada originalmente DEBE preservarse para redirección post-login.

#### Escenario: Acceso sin sesión

- DADO que no tengo cookie de sesión válida
- CUANDO intento acceder a cualquier ruta protegida (ej. `/proyectos`)
- ENTONCES soy redirigido a `/login`
- Y después de autenticarme retorno a la URL original

#### Escenario: Acceso a login con sesión activa

- DADO que ya tengo sesión válida
- CUANDO accedo a `/login`
- ENTONCES soy redirigido al panel principal

### Requisito: Cierre de sesión

El sistema DEBE proveer un mecanismo de cierre de sesión que invalide la cookie y elimine los datos de sesión del cliente.

#### Escenario: Cierre de sesión exitoso

- DADO que tengo sesión activa
- CUANDO presiono "Cerrar sesión"
- ENTONCES la cookie de sesión se invalida
- Y soy redirigido a `/login`

#### Escenario: Acceso tras cierre

- DADO que cerré sesión
- CUANDO intento acceder a una ruta protegida
- ENTONCES soy redirigido a `/login`
- Y se me solicita autenticarme de nuevo

## Requisitos no funcionales

### Seguridad

- Las contraseñas DEBEN almacenarse con bcryptjs (cost factor ≥ 10). NUNCA en texto plano.
- La cookie de sesión DEBE ser `HttpOnly`, `Secure` (producción), `SameSite=strict`.
- El secreto de firma de iron-session DEBE provenir de variable de entorno (`IRON_SESSION_SECRET`).
- El sistema NO DEBE diferenciar entre correo inexistente y contraseña incorrecta (previene enumeración de usuarios).
- La sesión DEBE expirar tras 24 horas de inactividad.

### Rendimiento

- La verificación de sesión en middleware DEBE completarse en < 50 ms.
- La consulta de usuario en login DEBE usar índice sobre `email` (ya definido como `@unique` en Prisma).

## Fuera de alcance

- Recuperación de contraseña.
- Múltiples roles o permisos granulares (futuro HU-6.1).
- UI del panel principal (solo layout protegido vacío).
- Rate limiting explícito (se delega a infraestructura).
- Autenticación de doble factor.
