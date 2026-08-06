# Spec: gestion-casos-prueba

## Overview

CRUD de casos de prueba asociados a un proyecto. Solo superadmin puede mutar. El sistema valida `rutaScript` antes de persistir y garantiza unicidad de `codigo` por proyecto.

## Requirements

### Requirement: Crear caso con validación eager

El sistema DEBE permitir registrar un `casoPrueba` con `codigo` (`CP-XXXX-YY`), `nombre`, `rutaScript` y `responsableId`. El sistema DEBE validar que `rutaScript` sea accesible desde `PLAYWRIGHT_SCRIPTS_ROOT` antes de guardar. El sistema DEBE rechazar códigos duplicados dentro del mismo proyecto.

#### Scenario: Crear caso válido

- GIVEN superadmin autenticado y proyecto existente
- WHEN POST `/api/casos` con datos válidos y `rutaScript` accesible
- THEN el caso se crea con `201 Created`
- AND aparece en el listado del proyecto con estado `sin ejecuciones`

#### Scenario: Script inexistente

- GIVEN superadmin y proyecto existente
- WHEN POST `/api/casos` con `rutaScript` inexistente
- THEN devuelve `400 Bad Request`
- AND el error indica script no accesible
- AND ningún caso queda registrado

#### Scenario: Código duplicado en mismo proyecto

- GIVEN proyecto con `CP-AUTH-01` existente
- WHEN POST `/api/casos` con mismo `codigo` en ese proyecto
- THEN devuelve `409 Conflict`
- AND el caso NO se registra

### Requirement: Listado dual-contexto

El sistema DEBE proveer vista global `/casos` con casos activos agrupados por proyecto, y vista contextual `/proyectos/[id]/casos` filtrada por proyecto.

#### Scenario: Listado global agrupado

- GIVEN casos en proyectos A y B
- WHEN GET `/api/casos`
- THEN lista todos los casos activos agrupados por `proyectoId`

#### Scenario: Listado contextual filtrado

- GIVEN 3 casos en proyecto X y 2 en proyecto Y
- WHEN GET `/api/casos?proyectoId=proyecto-x`
- THEN contiene exactamente 3 casos
- AND ninguno pertenece a proyecto Y

### Requirement: Edición inline y soft-delete

El sistema DEBE permitir editar `codigo`, `nombre`, `rutaScript` y `responsableId`, validando la ruta del script. El sistema DEBE implementar soft-delete (`activo=false`).

#### Scenario: Editar caso con script válido

- GIVEN caso existente
- WHEN PUT `/api/casos/[id]` con `rutaScript` válida
- THEN se actualiza con `200 OK`

#### Scenario: Editar caso con script inválido

- GIVEN caso existente
- WHEN PUT `/api/casos/[id]` con `rutaScript` inexistente
- THEN devuelve `400 Bad Request`
- AND el caso NO se modifica

#### Scenario: Soft-delete

- GIVEN caso existente
- WHEN DELETE `/api/casos/[id]`
- THEN marca `activo=false` con `204 No Content`
- AND GET `/api/casos/[id]` devuelve `404 Not Found`

### Requirement: Autorización superadmin

Solo usuarios con rol superadmin DEBEN poder crear, editar o eliminar casos.

#### Scenario: Usuario no superadmin intenta mutar

- GIVEN usuario autenticado sin rol superadmin
- WHEN POST `/api/casos` con datos válidos
- THEN devuelve `403 Forbidden`
- AND ningún caso es creado

## API Shape

### POST /api/casos
Request: `{codigo, nombre, rutaScript, responsableId, proyectoId}`  
Response: `201 Created` — caso con `estado: "sin ejecuciones"`  
Errors: `400` (validación/script), `403` (no superadmin), `409` (código duplicado)

### GET /api/casos
Query: `proyectoId` (optional)  
Response: `200 OK` — lista agrupada o filtrada

### PUT /api/casos/[id]
Request: campos opcionales  
Response: `200 OK`  
Errors: `400`, `403`, `404`

### DELETE /api/casos/[id]
Response: `204 No Content`  
Errors: `403`, `404`
