# Spec: gestion-proyectos

## Overview

CRUD completo de proyectos asociados a un espacio de empresa, con listado en grilla que muestra métricas de la última ejecución de casos de prueba. Solo usuarios con rol superadmin pueden crear, editar o eliminar proyectos. El sistema impide la eliminación de espacios que tengan proyectos activos (borrado restrictivo).

## Scenarios

### Scenario: Superadmin crea un proyecto dentro de un espacio
- **Given** el usuario tiene rol superadmin y está autenticado
- **And** existe un espacio con ID `espacio-uuid`
- **When** POST `/api/proyectos/` con `{ "nombre": "Proyecto Alpha", "ambiente": "QA", "espacioId": "espacio-uuid" }`
- **Then** el proyecto se crea exitosamente con estado `201 Created`
- **And** el proyecto queda asociado únicamente al espacio `espacio-uuid`
- **And** la respuesta incluye el `id` del proyecto creado

### Scenario: Usuario sin rol superadmin intenta crear un proyecto
- **Given** el usuario está autenticado pero NO tiene rol superadmin
- **When** POST `/api/proyectos/` con datos válidos
- **Then** el sistema devuelve `403 Forbidden`
- **And** ningún proyecto es creado

### Scenario: Crear proyecto sin espacioId devuelve error de validación
- **Given** el usuario tiene rol superadmin
- **When** POST `/api/proyectos/` con `{ "nombre": "Proyecto Sin Espacio", "ambiente": "DEV" }` (sin espacioId)
- **Then** el sistema devuelve `400 Bad Request`
- **And** el error indica que `espacioId` es requerido

### Scenario: Consultar un proyecto existente devuelve conteo de casos
- **Given** existe un proyecto con ID `proyecto-uuid` que tiene 5 casos de prueba
- **When** GET `/api/proyectos/proyecto-uuid`
- **Then** la respuesta incluye `"totalCasos": 5`
- **And** `"casosConformes": <n>"` y `"casosNoConformes": <n>"` reflejan la última ejecución
- **And** `"fechaUltimaEjecucion": "<ISO-8601>"` indica cuándo fue la última ejecución

### Scenario: Consultar un proyecto nuevo devuelve cero casos
- **Given** existe un proyecto con ID `proyecto-nuevo` sin casos de prueba
- **When** GET `/api/proyectos/proyecto-nuevo`
- **Then** la respuesta incluye `"totalCasos": 0`
- **And** `"casosConformes": 0` y `"casosNoConformes": 0`
- **And** `"fechaUltimaEjecucion": null`

### Scenario: Listar proyectos de un espacio devuelve solo proyectos de ese espacio
- **Given** existen 3 proyectos en espacio-A y 2 proyectos en espacio-B
- **When** GET `/api/proyectos/?espacioId=espacio-A`
- **Then** la respuesta contiene exactamente 3 proyectos
- **And** ninguno pertenece a espacio-B

### Scenario: Grilla de proyectos muestra tarjeta con todas las métricas
- **Given** existe un proyecto "Alpha" en el espacio "Empresa X"
- **When** el usuario accede a `/espacios/empresa-x/proyectos`
- **Then** cada tarjeta de proyecto muestra:
  - Chip con nombre del espacio ("Empresa X")
  - Nombre del proyecto ("Alpha")
  - Ambiente ("QA")
  - Conteo total de casos
  - Conteo de casos conformes en última ejecución
  - Conteo de casos no conformes en última ejecución
  - Fecha de última ejecución (formato legible)

### Scenario: Superadmin edita un proyecto existente
- **Given** el usuario tiene rol superadmin
- **And** existe un proyecto con ID `proyecto-uuid`
- **When** PUT `/api/proyectos/proyecto-uuid` con `{ "nombre": "Alpha v2", "ambiente": "PROD" }`
- **Then** el proyecto se actualiza con estado `200 OK`
- **And** la respuesta refleja los nuevos valores

### Scenario: Superadmin elimina un proyecto
- **Given** el usuario tiene rol superadmin
- **And** existe un proyecto con ID `proyecto-uuid`
- **When** DELETE `/api/proyectos/proyecto-uuid`
- **Then** el proyecto se elimina con estado `204 No Content`
- **And** GET `/api/proyectos/proyecto-uuid` devuelve `404 Not Found`

### Scenario: Eliminar espacio con proyectos activos devuelve error
- **Given** existe un espacio con ID `espacio-con-proyectos`
- **And** ese espacio tiene al menos 1 proyecto asociado
- **When** DELETE `/api/espacios/espacio-con-proyectos`
- **Then** el sistema devuelve `409 Conflict`
- **And** el error indica que hay proyectos activos impide la eliminación
- **And** el espacio NO es eliminado

### Scenario: Eliminar espacio sin proyectos permite la operación
- **Given** existe un espacio con ID `espacio-vacio` sin proyectos
- **When** DELETE `/api/espacios/espacio-vacio`
- **Then** el espacio se elimina con estado `204 No Content`

## API Shape

### POST /api/proyectos/
**Request:**
```json
{
  "nombre": "string (required, max 100 chars)",
  "ambiente": "string (required, max 50 chars)",
  "espacioId": "string (required, UUID)"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "nombre": "string",
  "ambiente": "string",
  "espacioId": "uuid",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**Errors:**
- `400 Bad Request` — validación fallida (campos requeridos, formato)
- `403 Forbidden` — usuario sin rol superadmin

---

### GET /api/proyectos/
**Query params:** `espacioId` (required, UUID)

**Response:** `200 OK`
```json
{
  "proyectos": [
    {
      "id": "uuid",
      "nombre": "string",
      "ambiente": "string",
      "espacioId": "uuid",
      "totalCasos": 0,
      "casosConformes": 0,
      "casosNoConformes": 0,
      "fechaUltimaEjecucion": "ISO-8601 | null"
    }
  ]
}
```

---

### GET /api/proyectos/[id]/
**Response:** `200 OK`
```json
{
  "id": "uuid",
  "nombre": "string",
  "ambiente": "string",
  "espacioId": "uuid",
  "totalCasos": 0,
  "casosConformes": 0,
  "casosNoConformes": 0,
  "fechaUltimaEjecucion": "ISO-8601 | null",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**Errors:**
- `404 Not Found` — proyecto no existe

---

### PUT /api/proyectos/[id]/
**Request:**
```json
{
  "nombre": "string (optional, max 100 chars)",
  "ambiente": "string (optional, max 50 chars)"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "nombre": "string",
  "ambiente": "string",
  "espacioId": "uuid",
  "updatedAt": "ISO-8601"
}
```

**Errors:**
- `400 Bad Request` — validación fallida
- `403 Forbidden` — usuario sin rol superadmin
- `404 Not Found` — proyecto no existe

---

### DELETE /api/proyectos/[id]/
**Response:** `204 No Content`

**Errors:**
- `403 Forbidden` — usuario sin rol superadmin
- `404 Not Found` — proyecto no existe

---

### DELETE /api/espacios/[id]/
**Response:** `204 No Content`

**Errors:**
- `404 Not Found` — espacio no existe
- `409 Conflict` — el espacio tiene proyectos activos (onDelete: Restrict)