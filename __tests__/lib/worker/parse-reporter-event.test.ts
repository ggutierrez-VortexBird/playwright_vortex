// __tests__/lib/worker/parse-reporter-event.test.ts
// TDD RED/GREEN/TRIANGULATE for HU-4.5 extended parser

import { parseReporterEvent } from "@/lib/worker/runner";

describe("parseReporterEvent — 6 event types (HU-4.5)", () => {
  it("parsea evento env", () => {
    const event = parseReporterEvent(
      JSON.stringify({ type: "env", navegador: "chromium", sistemaOperativo: "Linux", nodoEjecucion: "host" })
    );
    expect(event).toEqual({
      type: "env",
      navegador: "chromium",
      sistemaOperativo: "Linux",
      nodoEjecucion: "host",
    });
  });

  it("parsea evento step con nuevos campos", () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: "step",
        numero: 1,
        descripcion: "Test",
        estado: "paso",
        duracionMs: 100,
        selfHealed: false,
        errorMsg: null,
        resultadoEsperado: "Debe cargar",
        resultadoObtenido: null,
        errorCount: 0,
      })
    );
    expect(event).toMatchObject({
      type: "step",
      numero: 1,
      resultadoEsperado: "Debe cargar",
      errorCount: 0,
    });
  });

  it("parsea evento substep", () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: "substep",
        parentTestId: 1,
        numero: 1,
        tipo: "action",
        descripcion: "Click",
        estado: "paso",
        duracionMs: 50,
        errorMsg: null,
      })
    );
    expect(event).toMatchObject({ type: "substep", parentTestId: 1, tipo: "action" });
  });

  it("parsea evento log", () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: "log",
        parentTestId: 1,
        parentSubstepId: null,
        ts: "2026-08-20T10:00:00Z",
        level: "error",
        msg: "boom",
        source: "page",
      })
    );
    expect(event).toMatchObject({ type: "log", level: "error", msg: "boom" });
  });

  it("parsea evento assertion", () => {
    const event = parseReporterEvent(
      JSON.stringify({ type: "assertion", parentTestId: 1, descripcion: "is visible", ok: true })
    );
    expect(event).toMatchObject({ type: "assertion", ok: true });
  });

  it("parsea evento end con aserciones", () => {
    const event = parseReporterEvent(
      JSON.stringify({
        type: "end",
        estado: "paso",
        duracionMs: 5000,
        asercionesTotal: 10,
        asercionesOk: 9,
        asercionesFail: 1,
      })
    );
    expect(event).toMatchObject({ type: "end", asercionesTotal: 10, asercionesFail: 1 });
  });

  it("retorna null para JSON sin campo type", () => {
    const event = parseReporterEvent(JSON.stringify({ numero: 1, descripcion: "Test" }));
    expect(event).toBeNull();
  });

  it("retorna null para type desconocido", () => {
    const event = parseReporterEvent(JSON.stringify({ type: "unknown", data: "x" }));
    expect(event).toBeNull();
  });

  it("retorna null para línea no-JSON", () => {
    expect(parseReporterEvent("not json")).toBeNull();
  });
});
