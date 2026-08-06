# Delta for autenticacion

## MODIFIED Requirements

### Requirement: Protección de rutas y autorización de Server Actions

El sistema DEBE proteger todas las rutas internas excepto `/login`. Si no existe sesión válida, el usuario DEBE ser redirigido a `/login`. La URL solicitada originalmente DEBE preservarse para redirección post-login. El sistema DEBE proveer una utilidad compartida `requireSuperadmin()` en `lib/auth.ts` invocable desde cualquier Server Action para validar rol superadmin.
(Previously: Solo protección de rutas por middleware; sin utilidad compartida documentada)

#### Scenario: Acceso sin sesión

- DADO que no tengo cookie de sesión válida
- CUANDO intento acceder a cualquier ruta protegida (ej. `/proyectos`)
- ENTONCES soy redirigido a `/login`
- Y después de autenticarme retorno a la URL original

#### Scenario: Acceso a login con sesión activa

- DADO que ya tengo sesión válida
- CUANDO accedo a `/login`
- ENTONCES soy redirigido al panel principal

#### Scenario: Server Action requiere superadmin

- DADO un usuario autenticado sin rol superadmin
- CUANDO invoco una Server Action protegida (espacios, proyectos o casos)
- ENTONCES `requireSuperadmin()` devuelve error `403 Forbidden`
- Y la mutación no se ejecuta
