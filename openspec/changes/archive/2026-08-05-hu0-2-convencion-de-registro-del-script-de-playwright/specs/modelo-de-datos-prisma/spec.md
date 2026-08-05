# Delta for modelo-de-datos-prisma

## ADDED Requirements

### Requirement: Semántica de casoPrueba.rutaScript

El campo `casoPrueba.rutaScript` MUST almacenar una ruta relativa POSIX, sin leading slash, resoluble desde `PLAYWRIGHT_SCRIPTS_ROOT`.

#### Scenario: Ruta relativa válida en modelo

- GIVEN el modelo Prisma con `casoPrueba.rutaScript: String`
- WHEN se inserta `rutaScript="proy/caso.spec.ts"`
- THEN se acepta como valor válido
- AND el worker puede resolverla desde `PLAYWRIGHT_SCRIPTS_ROOT`
