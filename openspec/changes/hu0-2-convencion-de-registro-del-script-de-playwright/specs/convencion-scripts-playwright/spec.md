# Spec: convencion-scripts-playwright

## Purpose

Reglas de ruta, formato, validación y resolución para que el worker ejecute scripts Playwright sin configuración adicional por caso.

## Requirements

### Requirement: Ruta relativa POSIX

`casoPrueba.rutaScript` MUST almacenar una ruta relativa en formato POSIX, sin leading slash, relativa a `PLAYWRIGHT_SCRIPTS_ROOT` (default `/app/playwright-scripts`).

#### Scenario: Resolución correcta

- GIVEN `PLAYWRIGHT_SCRIPTS_ROOT=/app/playwright-scripts`
- AND `rutaScript="bancoomeva/login.spec.ts"`
- WHEN el worker hace `path.posix.join(ROOT, rutaScript)`
- THEN resulta `/app/playwright-scripts/bancoomeva/login.spec.ts`

### Requirement: Formato y seguridad

La ruta MUST terminar en `.spec.ts` o `.test.ts`. MUST NOT contener `..`, leading `/`, ni caracteres de control (U+0000–U+001F).

#### Scenario: Formato válido

- GIVEN `rutaScript="proy/caso.spec.ts"`
- WHEN se valida formato y seguridad
- THEN pasa ambas validaciones

#### Scenario: Path traversal rechazado

- GIVEN `rutaScript="../../../etc/passwd"`
- WHEN se valida seguridad
- THEN falla antes de acceder al filesystem

#### Scenario: Extensión inválida

- GIVEN `rutaScript="proy/caso.js"`
- WHEN se valida formato
- THEN falla con error de extensión no soportada

### Requirement: Validación eager al registrar

Al registrar un caso, el sistema MUST verificar que el archivo existe en `PLAYWRIGHT_SCRIPTS_ROOT`. Si no existe, MUST rechazar con error 400.

#### Scenario: Script existe al registrar

- GIVEN archivo presente en ruta resuelta
- WHEN se registra el caso
- THEN el registro se completa exitosamente

#### Scenario: Script inexistente al registrar

- GIVEN archivo ausente en ruta resuelta
- WHEN se registra el caso
- THEN el sistema rechaza con error 400 indicando ruta inexistente

### Requirement: Validación lazy al ejecutar

El worker MUST verificar existencia del archivo antes de lanzar Playwright. Si falla, MUST marcar la ejecución como `errorMotor`.

#### Scenario: Script desaparece después del registro

- GIVEN un caso registrado con ruta válida
- AND el archivo fue borrado después del registro
- WHEN el worker intenta ejecutar
- THEN la ejecución se marca como `errorMotor`
- AND el mensaje indica script no encontrado
