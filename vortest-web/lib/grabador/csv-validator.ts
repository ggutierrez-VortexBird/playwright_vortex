/** Parser y validador de CSV para data-driven: encabezado obligatorio, comillas dobles, sin delimitadores distintos de coma ni BOM. */

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

/** Parsea el CSV y devuelve encabezados + filas; con `expectedHeaders` valida además que coincidan exactamente. */
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

  // Detecta celdas de encabezado vacías
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

  // Valida contra los encabezados esperados si se pasaron
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

  // Construye las filas (sin la fila de encabezado)
  const filas: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Se omiten las filas totalmente vacías (p. ej. salto de línea final)
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

/** Divide el texto CSV en filas respetando campos entre comillas con saltos de línea o comas. */
function splitCsvRows(texto: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (inQuotes) {
      if (ch === '"') {
        // Comilla escapada dentro de comillas
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
      // Se omite el retorno de carro (CRLF)
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
  // Último campo/fila
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}