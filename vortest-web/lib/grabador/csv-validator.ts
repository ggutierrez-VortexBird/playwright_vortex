/**
 * lib/grabador/csv-validator.ts — parser + validador de CSV para
 * data-driven (HU-G13).
 *
 * Decisión: NO usamos papaparse (no está en el repo y el ACTA-plan
 * permite "simple custom parser — no es tan difícil para MVP").
 *
 * Soporta:
 *   - Header row obligatorio (primera fila).
 *   - Comillas dobles para escapar comas y saltos de línea.
 *   - Comillas escapadas vía doble comilla "".
 *   - Filas con menos columnas que el header → celdas vacías.
 *   - Filas con más columnas que el header → error "columna X extra".
 *
 * NO soporta (out of MVP):
 *   - Delimitadores distintos a coma.
 *   - BOM / encoding detection.
 *   - Tipos numéricos (todo se persiste como string en `filas`).
 */

export interface CsvValidationError {
  type: "missing_column" | "extra_column" | "empty_header" | "empty_csv" | "no_header";
  /** Para missing/extra_column: nombre de la columna. Para otros: null. */
  column?: string;
  message: string;
}

export interface CsvValidationResult {
  ok: boolean;
  headers: string[];
  filas: Array<Record<string, string>>;
  errors: CsvValidationError[];
}

/**
 * Parsea el texto CSV y devuelve headers + filas como records.
 * Si `expectedHeaders` se pasa, además valida que coincidan exactamente.
 */
export function parsearCsv(
  texto: string,
  expectedHeaders?: string[],
): CsvValidationResult {
  const errors: CsvValidationError[] = [];

  if (!texto || texto.trim() === "") {
    return {
      ok: false,
      headers: [],
      filas: [],
      errors: [{ type: "empty_csv", message: "El archivo CSV está vacío" }],
    };
  }

  const rows = splitCsvRows(texto);
  if (rows.length === 0) {
    return {
      ok: false,
      headers: [],
      filas: [],
      errors: [{ type: "empty_csv", message: "El archivo CSV está vacío" }],
    };
  }

  const headers = rows[0].map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === "")) {
    return {
      ok: false,
      headers,
      filas: [],
      errors: [{ type: "no_header", message: "La primera fila debe tener headers" }],
    };
  }

  // Detect per-column empty header cells (HU-G13: required for valid match).
  const hasEmptyHeader = headers.some((h) => h === "");
  if (hasEmptyHeader) {
    headers.forEach((h, idx) => {
      if (h === "") {
        errors.push({
          type: "empty_header",
          column: `columna ${idx + 1}`,
          message: `La columna ${idx + 1} no tiene header`,
        });
      }
    });
  }

  // Validate against expected headers if provided.
  if (expectedHeaders !== undefined) {
    const expectedSet = new Set(expectedHeaders);
    const actualSet = new Set(headers);
    for (const exp of expectedHeaders) {
      if (!actualSet.has(exp)) {
        errors.push({
          type: "missing_column",
          column: exp,
          message: `Falta columna "${exp}"`,
        });
      }
    }
    for (const act of headers) {
      if (!expectedSet.has(act)) {
        errors.push({
          type: "extra_column",
          column: act,
          message: `Sobra columna "${act}"`,
        });
      }
    }
  }

  // Build rows (skip the header row).
  const filas: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip totally blank rows (e.g. trailing newline).
    if (row.length === 1 && row[0] === "") continue;
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < row.length ? row[j] : "";
    }
    filas.push(record);
  }

  return {
    ok: errors.length === 0,
    headers,
    filas,
    errors,
  };
}

/**
 * Split CSV text into rows, respecting quoted fields that may contain
 * newlines or commas.
 */
function splitCsvRows(texto: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote inside quotes.
        if (texto[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") {
      // Skip carriage return (handle CRLF).
      continue;
    }
    if (ch === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }
    field += ch;
  }
  // Final field/row.
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}