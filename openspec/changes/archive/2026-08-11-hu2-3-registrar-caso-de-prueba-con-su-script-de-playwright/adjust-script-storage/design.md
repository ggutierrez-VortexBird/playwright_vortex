# Design: Ajuste HU-2.3 — Script en Base de Datos

## Resumen

Migrar el almacenamiento de scripts de Playwright desde el filesystem del servidor a la base de datos PostgreSQL. Reemplazar el componente de selección `<select>` (que lista archivos del servidor) por un `<input type="file">` que permite al usuario subir un archivo `.spec.ts` o `.test.ts` desde su máquina. El contenido del archivo se guarda en el campo `script` (tipo `TEXT`) del modelo `CasoPrueba`.

## Decisiones de Arquitectura

| Decisión | Elección | Alternativas | Rationale |
|---|---|---|---|
| Almacenamiento | `CasoPrueba.script: String @db.Text` | Filesystem (status quo), Blob/bytea | PostgreSQL TEXT soporta hasta 1GB, suficiente para scripts Playwright. Más simple que bytea. Self-contained: no requiere volumen compartido. |
| Campo adicional para nombre | `scriptFileName: String?` | No guardar nombre | Permite mostrar el nombre original en la UI (tabla, edición) sin parsear el contenido. Mejor UX. |
| API para creación/edición | `multipart/form-data` | Base64 en JSON | `FormData` con `File` es el estándar para uploads. Next.js App Router soporta `request.formData()` nativamente. |
| Validación de extensión | En API route (server-side) | Solo client-side (`accept` attribute) | Defence in depth: `accept` mejora UX pero la API debe validar siempre. |
| Eliminación de código | Eliminar `script-validation.ts`, `api/scripts`, `script-select.tsx` | Mantener para compatibilidad | Código muerto aumenta deuda técnica. La migración de datos cubre el caso de uso existente. |
| Migración de datos | Script SQL/Prisma que lee filesystem | Dejar `rutaScript` como legacy column | Migración única en el momento del deploy. Limpia y sin columnas huérfanas. |

## Cambios en el Schema Prisma

```prisma
model CasoPrueba {
  id             String   @id @default(uuid())
  proyectoId     String
  codigo         String
  nombre         String
  // ELIMINADO: rutaScript    String
  script         String   @db.Text
  scriptFileName String?  // NUEVO: nombre original del archivo
  responsableId  String
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  proyecto    Proyecto    @relation(fields: [proyectoId], references: [id], onDelete: Restrict)
  responsable Usuario     @relation("CasoPruebaResponsable", fields: [responsableId], references: [id], onDelete: Restrict)
  ejecuciones Ejecucion[]

  @@unique([proyectoId, codigo])
  @@index([responsableId])
  @@index([proyectoId])
}
```

## Migración de Datos

La migración de Prisma debe incluir un script de datos que:
1. Para cada `CasoPrueba` existente, lee el archivo en `PLAYWRIGHT_SCRIPTS_ROOT/{proyectoId}/{rutaScript}`.
2. Si el archivo existe, lee su contenido y lo guarda en `script`; guarda el nombre del archivo en `scriptFileName`.
3. Si el archivo no existe, deja `script` vacío y `scriptFileName` como `NULL`.
4. Elimina la columna `rutaScript`.

**Implementación:** Usar `$executeRaw` en un script post-migración o incluirlo en la migración SQL con `plv8` o un script Node.js separado.

**Decisión práctica:** Como Prisma migrations son SQL puro, se creará un script Node.js (`scripts/migrate-scripts-to-db.ts`) que corre después de `prisma migrate deploy` y antes del restart de la app.

```typescript
// scripts/migrate-scripts-to-db.ts
import { prisma } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";

async function migrate() {
  const casos = await prisma.casoPrueba.findMany();
  const root = process.env.PLAYWRIGHT_SCRIPTS_ROOT ?? "/app/playwright-scripts";

  for (const caso of casos) {
    // Nota: en la migración real, leeremos rutaScript antes de que sea eliminada
    // Esta lógica se ejecuta en el script de migración, no en la migración SQL
    const filePath = path.join(root, caso.proyectoId, caso.rutaScript);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      await prisma.casoPrueba.update({
        where: { id: caso.id },
        data: {
          script: content,
          scriptFileName: path.basename(caso.rutaScript),
        },
      });
      console.log(`Migrated: ${caso.codigo}`);
    } catch {
      console.warn(`File not found for caso ${caso.codigo}: ${filePath}`);
      await prisma.casoPrueba.update({
        where: { id: caso.id },
        data: { script: "", scriptFileName: null },
      });
    }
  }
}
```

**Nota:** La estrategia real es:
1. Crear migración Prisma que agrega `script` y `scriptFileName`.
2. Deploy: correr `prisma migrate deploy`.
3. Correr script de migración de datos (lee `rutaScript`, guarda en `script`).
4. Crear segunda migración Prisma que elimina `rutaScript`.
5. Deploy: correr `prisma migrate deploy` de nuevo.

Para simplificar el flujo de desarrollo local, se hará en una sola migración manual con SQL:
```sql
-- 1. Agregar columnas
ALTER TABLE "CasoPrueba" ADD COLUMN "script" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CasoPrueba" ADD COLUMN "scriptFileName" TEXT;

-- 2. La migración de datos se hace vía script Node.js
-- 3. Eliminar columna vieja
ALTER TABLE "CasoPrueba" DROP COLUMN "rutaScript";
```

## Contratos de API

### POST /api/casos

**Request:** `multipart/form-data`
```
codigo: string
nombre: string
scriptFile: File (.spec.ts | .test.ts)
responsableId: string
proyectoId: string
```

**Response 201:**
```json
{
  "id": "uuid",
  "proyectoId": "uuid",
  "codigo": "CP-001",
  "nombre": "Login válido",
  "script": "import { test } from '@playwright/test'; ...",
  "scriptFileName": "login.spec.ts",
  "responsableId": "uuid",
  "estado": "sin ejecuciones",
  "activo": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response 400:**
```json
{ "error": "validation", "message": "El archivo debe ser .spec.ts o .test.ts" }
```

**Response 409:**
```json
{ "error": "conflict", "message": "Código duplicado en este proyecto" }
```

### PUT /api/casos/:id

**Request:** `multipart/form-data` (scriptFile es opcional; si no se envía, se conserva el script existente)
```
codigo: string (optional)
nombre: string (optional)
scriptFile: File (optional)
responsableId: string (optional)
```

**Response 200:** CasoPrueba actualizado.

### GET /api/casos (sin cambios en contrato de respuesta)

El campo `rutaScript` se reemplaza por `scriptFileName` en la respuesta serializada. El campo `script` completo **no** se incluye en el listado para no saturar la respuesta; solo se incluye en GET by ID si es necesario.

**Decisión:** En `listCasos`, incluir `scriptFileName` en vez de `rutaScript`. El campo `script` solo se devuelve en `GET /api/casos/:id`.

## Flujo de Datos

```
Usuario (superadmin)
    │ selecciona archivo .spec.ts
    ▼
ScriptFileInput (Client Component)
    │ onChange(File) → CreateCasoForm / EditCasoForm
    ▼
Formulario crea FormData
    │ POST /api/casos (multipart/form-data)
    ▼
API Route (app/api/casos/route.ts)
    │ request.formData()
    │ → extrae File
    │ → await file.text()
    │ → valida extensión
    ▼
Server Action (lib/casos/actions.ts)
    │ requireSuperadmin(session)
    │ → prisma.casoPrueba.create({ script, scriptFileName, ... })
    ▼
PostgreSQL
    │ CasoPrueba.script = TEXT
    │ CasoPrueba.scriptFileName = VARCHAR
```

## Componentes

### `components/casos/script-file-input.tsx` (NUEVO)

Reemplaza a `script-select.tsx`.

- Props: `value?: string` (contenido actual para modo edición), `fileName?: string`, `onChange(file: File | null)`, `disabled?: boolean`
- En creación: muestra `<input type="file" accept=".spec.ts,.test.ts">`
- En edición: si hay script existente, muestra nombre del archivo + botón "Reemplazar" que revela el input
- Validación client-side mínima (el `accept` del input)

### `components/casos/create-caso-form.tsx` (MODIFICAR)

- Reemplazar `<ScriptSelect>` por `<ScriptFileInput>`
- Cambiar estado `rutaScript: string` por `scriptFile: File | null`
- Cambiar `handleSubmit` para usar `FormData` en vez de `JSON.stringify`
- Eliminar `Content-Type: application/json` header (fetch pone el boundary automáticamente para FormData)

### `components/casos/edit-caso-form.tsx` (MODIFICAR)

- Igual que create, pero:
  - Pasa `value={caso.script}` y `fileName={caso.scriptFileName}` al `ScriptFileInput`
  - En `handleSubmit`, solo incluye `scriptFile` en el FormData si el usuario seleccionó un archivo nuevo
  - Si no hay archivo nuevo, el backend conserva el script existente

### `components/casos/caso-table.tsx` (MODIFICAR)

- Cambiar columna "Script" para mostrar `scriptFileName` (chip o texto) en vez de `rutaScript`
- Si `scriptFileName` es null, mostrar indicador genérico "Script cargado" o dejar vacío

## Backend

### `lib/casos/actions.ts` (MODIFICAR)

- Eliminar import de `validateScriptPath`
- Cambiar todas las referencias `rutaScript` → `script`
- Validar que `script` no esté vacío (string de longitud > 0)
- La validación de extensión se hace en la API route (tiene acceso al `File.name`), no en el action
- Mantener manejo de P2002 → 409

### `app/api/casos/route.ts` (MODIFICAR)

```typescript
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const scriptFile = formData.get("scriptFile") as File | null;
    const codigo = formData.get("codigo") as string;
    const nombre = formData.get("nombre") as string;
    const responsableId = formData.get("responsableId") as string;
    const proyectoId = formData.get("proyectoId") as string;

    if (!scriptFile) {
      return NextResponse.json({ error: "validation", message: "Debes seleccionar un archivo de script" }, { status: 400 });
    }

    const fileName = scriptFile.name;
    if (!fileName.endsWith(".spec.ts") && !fileName.endsWith(".test.ts")) {
      return NextResponse.json({ error: "validation", message: "El archivo debe ser .spec.ts o .test.ts" }, { status: 400 });
    }

    const script = await scriptFile.text();

    const caso = await createCaso(
      { codigo, nombre, script, scriptFileName: fileName, responsableId, proyectoId },
      session
    );

    return NextResponse.json(caso, { status: 201 });
  } catch (err: any) {
    if (err.status === 400) return NextResponse.json(err.body, { status: 400 });
    if (err.status === 409) return NextResponse.json(err.body, { status: 409 });
    if (err.status === 403) return NextResponse.json(err.body, { status: 403 });
    return NextResponse.json({ error: "Error al crear caso" }, { status: 500 });
  }
}
```

### `app/api/casos/[id]/route.ts` (MODIFICAR)

Similar para PUT: si `scriptFile` está presente en FormData, leer y actualizar. Si no, conservar el existente.

## Tipos

### `types/caso.ts` (MODIFICAR)

```typescript
export interface CasoPrueba {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  script: string;
  scriptFileName: string | null;
  responsableId: string;
  estado: "sin ejecuciones" | "paso" | "fallo" | "reparado" | "errorMotor";
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CasoPruebaFormData {
  codigo: string;
  nombre: string;
  script: string;
  scriptFileName?: string | null;
  responsableId: string;
  proyectoId: string;
}

export interface CasoPruebaListItem {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  codigo: string;
  nombre: string;
  scriptFileName: string | null;  // Reemplaza rutaScript
  responsableId: string;
  responsableEmail: string;
  estado: string;
  activo: boolean;
  fechaUltimaEjecucion: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
```

## Testing Strategy

| Layer | Qué testear | Enfoque |
|---|---|---|
| E2E | Crear caso con file input | `page.setInputFiles('input[type="file"]', 'path/to/test.spec.ts')` |
| E2E | Editar caso reemplazando script | Seleccionar nuevo archivo, verificar que tabla muestra nuevo nombre |
| E2E | Validación de extensión | Intentar subir `.txt`, verificar error 400 |
| Integración | POST /api/casos con FormData | Enviar FormData válido, assert 201 y DB state |
| Integración | POST /api/casos con archivo inválido | Enviar `.txt`, assert 400 |
| Integración | PUT /api/casos/:id sin nuevo archivo | FormData sin scriptFile, assert que script no cambia |
| Unit | `createCaso` rechaza script vacío | Pasar script: "", assert 400 |

## Rollback

1. Revertir los commits de código.
2. Restaurar `rutaScript` en Prisma schema.
3. **Nota:** Los datos de `script` en BD se perderían. Para evitar esto, antes del rollback se podría correr un script que escriba los scripts de vuelta al filesystem. En desarrollo local, esto es aceptable.

## Impacto en HU Futuras

| HU | Impacto |
|---|---|
| HU-3.1 (Ejecución de scripts) | El motor debe leer `casoPrueba.script` en vez de leer archivo del disco. Esto es más simple (no requiere filesystem). |
| HU-5.1 (Actas de evidencia) | Sin impacto. |
| HU-7.x (Credenciales) | Sin impacto. |

## Archivos a Eliminar

- `app/api/scripts/route.ts`
- `lib/script-validation.ts`
- `components/casos/script-select.tsx`

## Archivos a Crear

- `components/casos/script-file-input.tsx`
- `scripts/migrate-scripts-to-db.ts` (script de migración de datos)

## Archivos a Modificar

- `prisma/schema.prisma`
- `types/caso.ts`
- `lib/casos/actions.ts`
- `app/api/casos/route.ts`
- `app/api/casos/[id]/route.ts`
- `components/casos/create-caso-form.tsx`
- `components/casos/edit-caso-form.tsx`
- `components/casos/caso-table.tsx`
- `e2e/casos.spec.ts`
