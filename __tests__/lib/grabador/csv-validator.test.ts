/**
 * Tests for lib/grabador/csv-validator.ts (HU-G13).
 *
 * Verifies:
 *   - Simple CSV with header + rows parses correctly.
 *   - Empty CSV is rejected.
 *   - Empty header row is rejected.
 *   - Missing expected column → error.
 *   - Extra column not in expected → error.
 *   - Quoted fields with embedded commas are preserved.
 *   - Quoted fields with embedded newlines are preserved.
 *   - Escaped double quotes ("") inside quoted fields.
 *   - Trailing newline is tolerated.
 *   - Rows shorter than header → empty cells.
 *   - Rows longer than header → ignored extras (MVP tolerance).
 */

import { parsearCsv } from "@/lib/grabador/csv-validator";

describe("parsearCsv — happy path", () => {
  it("parses simple CSV with header + 2 rows", () => {
    const csv = "usuario,clave\nadmin,secret\nroot,toor\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.headers).toEqual(["usuario", "clave"]);
    expect(r.filas).toEqual([
      { usuario: "admin", clave: "secret" },
      { usuario: "root", clave: "toor" },
    ]);
  });

  it("tolerates trailing newline", () => {
    const csv = "a,b\n1,2\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toEqual([{ a: "1", b: "2" }]);
  });

  it("treats CRLF same as LF", () => {
    const csv = "a,b\r\n1,2\r\n3,4\r\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas).toHaveLength(2);
  });
});

describe("parsearCsv — quoted fields", () => {
  it("preserves commas inside quotes", () => {
    const csv = 'nombre,desc\nfoo,"hola, mundo"\n';
    const r = parsearCsv(csv);
    expect(r.filas[0].desc).toBe("hola, mundo");
  });

  it("preserves newlines inside quotes", () => {
    const csv = 'a,b\n"line1\nline2",x\n';
    const r = parsearCsv(csv);
    expect(r.filas[0].a).toBe("line1\nline2");
  });

  it('handles escaped double quotes ("")', () => {
    const csv = 'a,b\n"he said ""hi""",ok\n';
    const r = parsearCsv(csv);
    expect(r.filas[0].a).toBe('he said "hi"');
  });
});

describe("parsearCsv — validation against expected headers (HU-G13)", () => {
  it("passes when CSV columns exactly match expected", () => {
    const csv = "usuario,saldo\nadmin,100\n";
    const r = parsearCsv(csv, ["usuario", "saldo"]);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("reports missing_column when CSV is missing an expected column", () => {
    const csv = "usuario\nadmin\n";
    const r = parsearCsv(csv, ["usuario", "saldo"]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "missing_column" && e.column === "saldo")).toBe(true);
  });

  it("reports extra_column when CSV has a column not in expected", () => {
    const csv = "usuario,saldo,cuenta\nadmin,100,42\n";
    const r = parsearCsv(csv, ["usuario", "saldo"]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "extra_column" && e.column === "cuenta")).toBe(true);
  });

  it("reports both missing and extra columns", () => {
    const csv = "usuario,foo\nadmin,bar\n";
    const r = parsearCsv(csv, ["usuario", "saldo"]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "missing_column")).toBe(true);
    expect(r.errors.some((e) => e.type === "extra_column")).toBe(true);
  });

  it("composes a clear user-facing message with both errors", () => {
    const csv = "usuario,foo\nadmin,bar\n";
    const r = parsearCsv(csv, ["usuario", "saldo"]);
    expect(r.ok).toBe(false);
    const message = r.errors.map((e) => e.message).join("; ");
    expect(message).toContain('Falta columna "saldo"');
    expect(message).toContain('Sobra columna "foo"');
  });
});

describe("parsearCsv — error cases", () => {
  it("rejects empty string", () => {
    const r = parsearCsv("");
    expect(r.ok).toBe(false);
    expect(r.errors[0].type).toBe("empty_csv");
  });

  it("rejects whitespace-only string", () => {
    const r = parsearCsv("   \n  \n");
    expect(r.ok).toBe(false);
  });

  it("rejects header row with all-empty cells", () => {
    const r = parsearCsv(",\nfoo,bar\n");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "no_header")).toBe(true);
  });

  it("reports per-column empty_header when only some headers are empty", () => {
    const r = parsearCsv("a,,c\n1,2,3\n");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.type === "empty_header" && e.column === "columna 2")).toBe(true);
  });
});

describe("parsearCsv — row width tolerance", () => {
  it("fills empty strings for cells beyond row width", () => {
    const csv = "a,b,c\n1,2\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("ignores extra cells beyond header width", () => {
    const csv = "a,b\n1,2,3,4\n";
    const r = parsearCsv(csv);
    expect(r.ok).toBe(true);
    expect(r.filas[0]).toEqual({ a: "1", b: "2" });
  });
});