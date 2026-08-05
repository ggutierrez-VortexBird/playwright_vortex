# Convención de Registro de Scripts de Playwright

> **Versión**: 1.0 (MVP)  
> **Ámbito**: Campo `casoPrueba.rutaScript` y resolución de rutas en el worker de ejecución.  
> **Idioma**: Español (convención de proyecto).  
> **Estado**: Vinculante para todas las HUs de Fase 2 y 3.

---

## 1. Propósito

Esta convención define el formato, la estructura de directorios y las reglas de validación para la ruta de un script de Playwright registrado en ACTA. Garantiza que:

- El worker pueda localizar y ejecutar el script **sin configuración adicional por caso**.
- Las rutas almacenadas en la base de datos sean **portables** entre entornos (dev, staging, prod).
- Se prevenga el **path traversal** y otros vectores de seguridad relacionados con rutas de archivo.

---

## 2. Formato de ruta

### 2.1 Ruta relativa POSIX

El campo `casoPrueba.rutaScript` **DEBE** almacenar una ruta relativa en formato POSIX:

- Separador de directorios: `/` (barra inclinada).
- **SIN** barra inicial (`/`).
- **SIN** segmentos de navegación ascendente (`..`).
- **SIN** caracteres de control (U+0000–U+001F).
- Relativa a `PLAYWRIGHT_SCRIPTS_ROOT`.

### 2.2 Root de resolución

El worker resuelve la ruta absoluta concatenando el root con la ruta relativa:

```typescript
const ROOT = process.env.PLAYWRIGHT_SCRIPTS_ROOT ?? '/app/playwright-scripts';
const absolutePath = path.posix.join(ROOT, casoPrueba.rutaScript);
```

- `PLAYWRIGHT_SCRIPTS_ROOT` es una variable de entorno con valor por defecto `/app/playwright-scripts`.
- En Docker (runtime soportado), este directorio se monta como volumen.

### 2.3 Extensiones soportadas

El archivo **DEBE** terminar en una de las siguientes extensiones:

- `.spec.ts` (preferida, convención del proyecto).
- `.test.ts` (aceptada por compatibilidad con Jest/Vitest).

No se aceptan `.js`, `.mjs`, `.jsx`, `.tsx` ni ninguna otra extensión.

---

## 3. Estructura de directorios

### 3.1 MVP (Fase 1–3)

```
PLAYWRIGHT_SCRIPTS_ROOT/
└── <proyecto-slug>/
    └── <nombre-libre>.spec.ts
```

- `proyecto-slug`: identificador único del proyecto en ACTA, en `kebab-case`, inmutable.
- `nombre-libre`: nombre descriptivo del caso de prueba, sugerido en `kebab-case`. El sistema **NO impone** el nombre ni verifica que coincida con `casoPrueba.codigo`.

### 3.2 Ejemplo completo

```
/app/playwright-scripts/
├── bancoomeva/
│   ├── auth/
│   │   └── login.spec.ts
│   └── transferencia.spec.ts
└── comfandi/
    └── consulta-saldo.spec.ts
```

Valores correspondientes en `casoPrueba.rutaScript`:

| Archivo en disco | Valor en `rutaScript` |
|------------------|-----------------------|
| `/app/playwright-scripts/bancoomeva/auth/login.spec.ts` | `bancoomeva/auth/login.spec.ts` |
| `/app/playwright-scripts/bancoomeva/transferencia.spec.ts` | `bancoomeva/transferencia.spec.ts` |
| `/app/playwright-scripts/comfandi/consulta-saldo.spec.ts` | `comfandi/consulta-saldo.spec.ts` |

### 3.3 Extensión futura (post-MVP)

Se evaluará en Checkpoint 2 la inclusión del espacio de trabajo en la jerarquía:

```
PLAYWRIGHT_SCRIPTS_ROOT/
└── <espacio-slug>/
    └── <proyecto-slug>/
        └── <nombre-libre>.spec.ts
```

Hasta nuevo aviso, la estructura MVP es la única válida.

---

## 4. Reglas de slug inmutables

Los `proyecto-slug` (y futuros `espacio-slug`) siguen estas reglas:

1. **Generación única**: se generan una sola vez al crear el proyecto/espacio.
2. **Inmutabilidad**: **NO** deben modificarse. Cambiar un slug rompe todas las rutas `rutaScript` almacenadas.
3. **Formato**: `kebab-case` (minúsculas, palabras separadas por guiones).
4. **Caracteres permitidos**: letras minúsculas `a-z`, dígitos `0-9`, guiones `-` y guiones bajos `_`.
5. **Sin espacios ni caracteres especiales**: tildes, eñes y símbolos deben transliterarse o omitirse.

Ejemplos de slugs válidos:

- `bancoomeva`
- `comfandi`
- `vortexbird-labs`
- `req-2481-auth`

---

## 5. Formato del archivo `.spec.ts`

El archivo **DEBE** ser un test de Playwright válido:

- Importa `@playwright/test`.
- Define al menos un bloque `test()` con `expect()`.
- No requiere metadatos exportados (`export const meta`, `export default`).
- No utiliza DSL propio ni formatos intermedios.

Ejemplo mínimo válido:

```typescript
import { test, expect } from '@playwright/test';

test('login con credenciales válidas', async ({ page }) => {
  await page.goto('https://ejemplo.com/login');
  await page.fill('input[name="usuario"]', 'admin');
  await page.fill('input[name="clave"]', 'secreto');
  await page.click('button[type="submit"]');
  await expect(page.locator('h1')).toHaveText('Bienvenido');
});
```

---

## 6. Validación

### 6.1 Doble capa: eager + lazy

La convención exige **dos momentos de validación** para detectar roturas de rutas:

| Momento | Quién | Qué valida | Respuesta ante fallo |
|---------|-------|------------|----------------------|
| **Eager** (registro) | Server Action / API route (`HU-2.3`) | Regex de seguridad + existencia con `fs.access` | Rechazo HTTP 400 con mensaje descriptivo |
| **Lazy** (ejecución) | Worker (`HU-3.1`, `HU-3.3`) | Existencia con `fs.access` antes de lanzar Playwright | Estado `errorMotor` con mensaje descriptivo |

### 6.2 Regex de sanitización

Antes de tocar el filesystem, toda ruta **DEBE** pasar la siguiente expresión regular:

```typescript
const SCRIPT_PATH_REGEX = /^(?!\/)(?!.*\.\.)(?!.*[\x00-\x1f])[\w./-]+\.(spec|test)\.ts$/;
```

Rechaza:

- Rutas absolutas (`/etc/passwd`).
- Path traversal (`../../etc/passwd`).
- Caracteres de control (`\x00`, `\n`, etc.).
- Extensiones no soportadas (`.js`, `.py`, etc.).

### 6.3 Verificación de existencia

```typescript
import { promises as fs } from 'fs';

await fs.access(absolutePath, fs.constants.R_OK);
```

- `R_OK`: el archivo existe y es legible.
- Si falla (`ENOENT` o `EACCES`), la validación se considera fallida.

---

## 7. Resolución de rutas

### 7.1 Funciones de soporte

El módulo `lib/script-validation.ts` provee dos funciones:

#### `resolveScriptPath(relativePath, root?)`

Resuelve una ruta relativa a absoluta **sin validar existencia**.

```typescript
resolveScriptPath('bancoomeva/login.spec.ts');
// → '/app/playwright-scripts/bancoomeva/login.spec.ts'
```

#### `validateScriptPath(relativePath, options?)`

Valida formato, seguridad y (opcionalmente) existencia del script.

```typescript
const result = await validateScriptPath('bancoomeva/login.spec.ts', {
  root: '/app/playwright-scripts',
  checkExists: true,
});

// Resultado cuando todo es válido:
// { valid: true, absolutePath: '/app/playwright-scripts/bancoomeva/login.spec.ts' }

// Resultado cuando falla la regex:
// { valid: false, error: 'Formato de ruta inválido.' }

// Resultado cuando no existe:
// { valid: false, absolutePath: '/app/...', error: 'El script no existe en la ruta configurada: ...' }
```

### 7.2 Flujo de ejecución del worker

```
casoPrueba.rutaScript
        │
        ▼
resolveScriptPath() ──► path.posix.join(ROOT, rutaScript)
        │
        ▼
fs.access(absolutePath, R_OK)
        │
   ┌────┴────┐
   ▼         ▼
 OK      ENOENT/EACCES
   │         │
   ▼         ▼
npx playwright test <abs>   errorMotor
```

Comando de ejecución:

```bash
npx playwright test /app/playwright-scripts/bancoomeva/login.spec.ts \
  --reporter=json \
  --output=/app/artefactos/ejecucion-<id>
```

---

## 8. Errores comunes y mensajes

| Situación | Mensaje sugerido (español) |
|-----------|---------------------------|
| Ruta con `..` | `"La ruta no puede contener segmentos '..'"` |
| Ruta absoluta (leading `/`) | `"La ruta debe ser relativa (sin barra inicial)"` |
| Caracteres de control | `"La ruta contiene caracteres no permitidos"` |
| Extensión inválida | `"Extensión no soportada. Use .spec.ts o .test.ts"` |
| Script no existe (eager) | `"El script no existe en la ruta configurada: <ruta>"` |
| Script no encontrado (lazy) | `"Script no encontrado: <ruta>"` |

---

## 9. Decisiones de arquitectura

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| Tipo de ruta | Relativa POSIX | Portable entre entornos; no acopla rutas absolutas del filesystem a la DB. |
| Root configurable | Env var `PLAYWRIGHT_SCRIPTS_ROOT` | Permite diferenciar dev/prod sin cambiar código ni DB. |
| Estructura | `proyecto-slug/<nombre>.spec.ts` | Suficiente para MVP; evita colisiones de nombre entre proyectos. |
| Slugs | Inmutables, kebab-case | Cambiar un slug rompe rutas históricas; la inmutabilidad es un requisito de estabilidad. |
| Validación | Eager (registro) + lazy (ejecución) | Doble red de seguridad; el usuario recibe feedback inmediato y el worker no falla silenciosamente. |
| Formato de archivo | Playwright estándar | Cero fricción para equipos externos que ya escriben tests con `@playwright/test`. |
| Ejecución | `npx playwright test <ruta-absoluta>` | El worker no requiere `playwright.config.ts` por proyecto en el MVP. |

---

## 10. Historial de cambios

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-08-05 | 1.0 | Convención inicial (MVP). Estructura `proyecto-slug/`. Extensión `.spec.ts` preferida. Validación eager+lazy. |
