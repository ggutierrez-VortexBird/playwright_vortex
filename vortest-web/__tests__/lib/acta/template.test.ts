// __tests__/lib/acta/template.test.ts
// HU-G19 — tests para la plantilla HTML del acta.

import { renderActaHTML } from "@/lib/acta/template";
import type { ActaTemplateInput, ActaTemplateEjecucion } from "@/lib/acta/types";

function mockEjecucion(over: Partial<ActaTemplateEjecucion> = {}): ActaTemplateEjecucion {
  return {
    id: "ejec-1",
    estado: "paso",
    inicioAt: "2026-08-12T10:00:00.000Z",
    finAt: "2026-08-12T10:02:00.000Z",
    duracionMs: 120000,
    errorMsg: null,
    entorno: "Producción",
    navegador: "Chrome 115",
    sistemaOperativo: "Linux",
    nodoEjecucion: "node-1",
    asercionesTotal: 10,
    asercionesOk: 9,
    asercionesFail: 1,
    casoPrueba: {
      nombre: "Login test",
      codigo: "CP-001",
      origen: "grabador",
      proyecto: {
        nombre: "Proyecto Login",
        ambiente: "QA",
        espacio: { nombre: "Espacio 1" },
      },
    },
    pasos: [
      { numero: 1, descripcion: "Navegar", estado: "paso", duracionMs: 1000 },
      { numero: 2, descripcion: "Click", estado: "fallo", duracionMs: 500, errorMsg: "timeout" },
    ],
    ...over,
  };
}

function buildInput(over: Partial<ActaTemplateInput> = {}): ActaTemplateInput {
  return {
    ejecucion: mockEjecucion(),
    actaConsecutivo: "ACE-2026-0001",
    generadoEn: new Date("2026-08-13T10:00:00Z"),
    ...over,
  };
}

describe("renderActaHTML", () => {
  it("incluye el consecutivo del acta en el HTML", () => {
    const html = renderActaHTML(buildInput({ actaConsecutivo: "ACE-2026-0042" }));
    expect(html).toContain("ACE-2026-0042");
  });

  it("incluye los datos del caso y proyecto", () => {
    const html = renderActaHTML(buildInput());
    expect(html).toContain("Login test");
    expect(html).toContain("CP-001");
    expect(html).toContain("Proyecto Login");
    expect(html).toContain("Espacio 1");
  });

  it("marca 'Conforme' cuando el estado es 'paso'", () => {
    const html = renderActaHTML(buildInput());
    expect(html).toContain("Conforme");
  });

  it("marca 'No conforme' cuando hay pasos en fallo", () => {
    const html = renderActaHTML(buildInput({ ejecucion: mockEjecucion({ estado: "fallo" }) }));
    expect(html).toContain("No conforme");
    expect(html).toContain("paso 2"); // referencia al paso que falló
  });

  it("lista todos los pasos con su estado", () => {
    const html = renderActaHTML(buildInput());
    expect(html).toContain("Navegar");
    expect(html).toContain("Click");
    expect(html).toContain("Conforme"); // paso 1
    expect(html).toContain("No conforme"); // paso 2
  });

  it("escapa HTML en campos libres (defense in depth)", () => {
    const html = renderActaHTML(
      buildInput({
        ejecucion: mockEjecucion({
          casoPrueba: {
            ...mockEjecucion().casoPrueba,
            nombre: "<script>alert(1)</script>",
          } as any,
        }),
      }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("muestra el bloque de error si errorMsg está set", () => {
    const html = renderActaHTML(
      buildInput({
        ejecucion: mockEjecucion({
          estado: "errorMotor",
          errorMsg: "No se pudo cargar el browser",
        }),
      }),
    );
    expect(html).toContain("Detalle del error");
    expect(html).toContain("No se pudo cargar el browser");
  });

  it("omite el bloque de error si errorMsg es null", () => {
    const html = renderActaHTML(buildInput({ ejecucion: mockEjecucion({ errorMsg: null }) }));
    expect(html).not.toContain("Detalle del error");
  });

  it("incluye duración, inicio y fin formateados", () => {
    const html = renderActaHTML(buildInput());
    expect(html).toMatch(/2m 00s|2m 0s/); // duracionMs 120000 → "2m 00s"
  });

  it("formatea duración en segundos si es menor a 1 minuto", () => {
    const html = renderActaHTML(
      buildInput({ ejecucion: mockEjecucion({ duracionMs: 12345 }) }),
    );
    expect(html).toContain("12.3s");
  });

  it("incluye las aserciones en la sección de entorno", () => {
    const html = renderActaHTML(buildInput());
    expect(html).toContain("10 total");
    expect(html).toContain("9 ok");
    expect(html).toContain("1 fallo");
  });
});