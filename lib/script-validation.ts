/**
 * @fileoverview Validación y resolución de rutas de scripts de Playwright.
 *
 * Este módulo implementa la convención de registro definida en
 * `documentacion/convencion-scripts-playwright.md`.
 *
 * - `validateScriptPath`: validación eager (registro) con regex + fs.access.
 * - `resolveScriptPath`: resolución de ruta relativa a absoluta sin validar existencia.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Expresión regular de sanitización obligatoria para toda ruta de script.
 *
 * Requisitos:
 * - Sin barra inicial (no rutas absolutas).
 * - Sin segmentos ".." (prevención de path traversal).
 * - Sin caracteres de control U+0000–U+001F.
 * - Solo caracteres alfanuméricos, guiones, guiones bajos, puntos y barras.
 * - Extensión .spec.ts o .test.ts.
 */
export const SCRIPT_PATH_REGEX =
  /^(?!\/)(?!.*\.\.)(?!.*[\x00-\x1f])[\w./-]+\.(spec|test)\.ts$/;

/**
 * Resultado estandarizado de una validación de ruta de script.
 */
export interface ScriptValidationResult {
  /** Indica si la ruta pasó todas las validaciones aplicadas. */
  valid: boolean;
  /** Ruta absoluta resuelta (disponible cuando la sanitización pasa). */
  absolutePath?: string;
  /** Mensaje descriptivo del error (disponible cuando valid es false). */
  error?: string;
}

/**
 * Resuelve una ruta relativa a una ruta absoluta POSIX sin validar existencia.
 *
 * @param relativePath - Ruta relativa almacenada en casoPrueba.rutaScript.
 * @param root - Directorio base. Por defecto toma `process.env.PLAYWRIGHT_SCRIPTS_ROOT`
 *               o `/app/playwright-scripts` si no está definida.
 * @returns Ruta absoluta con separadores POSIX.
 */
export function resolveScriptPath(
  relativePath: string,
  root?: string
): string {
  const resolvedRoot =
    root ?? process.env.PLAYWRIGHT_SCRIPTS_ROOT ?? '/app/playwright-scripts';

  // Garantizamos separadores POSIX para coherencia con el runtime Linux/Docker.
  return path.posix.join(resolvedRoot, relativePath);
}

/**
 * Valida formato, seguridad y (opcionalmente) existencia de un script de Playwright.
 *
 * Flujo:
 * 1. Sanitización con SCRIPT_PATH_REGEX.
 * 2. Resolución a ruta absoluta.
 * 3. Si checkExists !== false, verificación con fs.access (legibilidad).
 *
 * @param relativePath - Ruta relativa a validar.
 * @param options - Configuración opcional de root y verificación de existencia.
 * @returns Promise<ScriptValidationResult> con el resultado de la validación.
 */
export async function validateScriptPath(
  relativePath: string,
  options?: { root?: string; checkExists?: boolean }
): Promise<ScriptValidationResult> {
  // 1. Sanitización previa (eager): regex obligatoria antes de tocar disco.
  if (!SCRIPT_PATH_REGEX.test(relativePath)) {
    return {
      valid: false,
      error:
        'Formato de ruta inválido. Debe ser relativa (sin leading /), sin "..", sin caracteres de control, y terminar en .spec.ts o .test.ts.',
    };
  }

  // 2. Resolución a ruta absoluta.
  const absolutePath = resolveScriptPath(relativePath, options?.root);

  // 3. Verificación de existencia (por defecto activa).
  const shouldCheckExists = options?.checkExists !== false;

  if (shouldCheckExists) {
    try {
      await fs.access(absolutePath, fs.constants.R_OK);
    } catch (err) {
      const errorCode = (err as NodeJS.ErrnoException)?.code;

      if (errorCode === 'ENOENT') {
        return {
          valid: false,
          absolutePath,
          error: `El script no existe en la ruta configurada: ${absolutePath}`,
        };
      }

      if (errorCode === 'EACCES') {
        return {
          valid: false,
          absolutePath,
          error: `El script existe pero no es legible: ${absolutePath}`,
        };
      }

      // Error inesperado de filesystem (EPERM, ENOTDIR, etc.)
      return {
        valid: false,
        absolutePath,
        error: `Error al acceder al script: ${(err as Error).message}`,
      };
    }
  }

  return { valid: true, absolutePath };
}
