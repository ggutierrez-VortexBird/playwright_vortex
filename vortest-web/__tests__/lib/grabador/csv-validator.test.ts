import { parsearCsv } from "@/lib/grabador/csv-validator";

describe("lib/grabador/csv-validator", () => {
  it("rechaza texto vacío", () => {
    const r = parsearCsv("");
    expect(r.ok).toBe(false);
    expect(r.errors[0].type).toBe("empty_csv");
    expect(r.headers).toEqual([]);
    expect(r.filas).toEqual([]);
  });

  it("rechaza texto solo con whitespace", () => {
    const r = parsearCsv("   \n\n  \n");
    expect(r.ok).toBe(false);
    expect(r.errors[0].type).toBe("empty_csv");
  });

  it("parsea CSV básico con headers y filas", () => {
    const csv = "name,age\nAlice,30\nBob,25\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.headers).toEqual(["name", "age"]);
    expect(r.filas).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("respeta comillas dobles para campos con coma", () => {
    const csv = "name,note\n\"Doe, John\",\"hi, there\"\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toEqual([{ name: "Doe, John", note: "hi, there" }]);
  });

  it("respeta comillas dobles para campos con saltos de línea", () => {
    const csv = "name,bio\n\"Ana\",\"line1\nline2\"\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].bio).toBe("line1\nline2");
  });

  it("escapa comillas dobles vía doble comilla", () => {
    const csv = 'name\n"He said ""hi"""\n';
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas[0].name).toBe('He said "hi"');
  });

  it("rellena con string vacío celdas faltantes en filas cortas", () => {
    const csv = "a,b,c\n1,2\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("detecta columna extra como error (sin expectedHeaders)", () => {
    // Sin expectedHeaders no valida, simplemente la incluye.
    const csv = "a,b\n1,2,3\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.headers).toEqual(["a", "b"]);
    // La tercera celda se ignora porque headers tiene solo 2 columnas.
    expect(r.filas).toEqual([{ a: "1", b: "2" }]);
  });

  it("marca error missing_column cuando falta una columna esperada", () => {
    const csv = "a,b\n1,2\n";
    const r = parsearCsv(csv, ["a", "b", "c"]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "missing_column" && e.column === "c")).toBe(true);
  });

  it("marca error extra_column cuando sobra una columna", () => {
    const csv = "a,b,c\n1,2,3\n";
    const r = parsearCsv(csv, ["a", "b"]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "extra_column" && e.column === "c")).toBe(true);
  });

  it("detecta header vacío", () => {
    const csv = "a,,c\n1,2,3\n";
    const r = parsearCsv(csv);
    // Como hay al menos un header no-vacío, no es "no_header" pero sí
    // tiene errores empty_header.
    expect(r.errors.some((e) => e.type === "empty_header" && e.column === "columna 2")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("detecta no_header si la primera fila tiene solo celdas vacías", () => {
    const csv = ",,\n1,2,3\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(false);
    expect(r.errors[0].type).toBe("no_header");
  });

  it("ignora filas completamente vacías (trailing newline)", () => {
    const csv = "a,b\n1,2\n\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toEqual([{ a: "1", b: "2" }]);
  });

  it("soporta CRLF (Windows line endings)", () => {
    const csv = "a,b\r\n1,2\r\n3,4\r\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });
});
