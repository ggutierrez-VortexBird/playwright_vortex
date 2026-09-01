/**
 * Tests for lib/grabador/translator.ts — DOM event → PasoLegible.
 *
 * Covers HU-G3 (panel de pasos en tiempo real) and HU-GR-1 partial
 * (password masking). Each test corresponds to a scenario in
 * openspec/changes/hu-g1-grabador-base/specs/modo-grabador/spec.md.
 *
 * SECURITY cases:
 *   - password events mask the value AND set isPassword marker (caller
 *     must persist valor=null, esValorSensible=true)
 *   - non-password events include the value verbatim
 */

import {
  traducirEvento,
  labelDeElemento,
  PASSWORD_MASK,
  type EventoDom,
  type SerializedElement,
} from "@/lib/grabador/translator";

function el(partial: Partial<SerializedElement> = {}): SerializedElement {
  return {
    tag: "button",
    text: "Ingresar",
    aria: "Ingresar",
    ...partial,
  };
}

function baseEvento(overrides: Partial<EventoDom> = {}): EventoDom {
  return {
    type: "click",
    target: el(),
    value: null,
    timestamp: 1_700_000_000_000,
    deltaFromPreviousMs: 0,
    ...overrides,
  };
}

describe("lib/grabador/translator", () => {
  describe("labelDeElemento", () => {
    it("returns 'elemento' when target is null", () => {
      expect(labelDeElemento(null)).toBe("elemento");
    });

    it("returns 'elemento' when target has no usable fields", () => {
      expect(labelDeElemento({ tag: "" })).toBe("elemento");
    });

    it("prefers visible text over aria-label", () => {
      expect(labelDeElemento({ text: "Visible", aria: "aria-name" })).toBe(
        "Visible",
      );
    });

    it("falls back to aria-label when text is empty", () => {
      expect(labelDeElemento({ text: "  ", aria: "aria-name" })).toBe(
        "aria-name",
      );
    });

    it("falls back to name when text and aria are empty", () => {
      expect(labelDeElemento({ name: "username" })).toBe("username");
    });

    it("falls back to testId when text, aria and name are empty", () => {
      expect(labelDeElemento({ testId: "btn-login" })).toBe("btn-login");
    });

    it("falls back to tag as last resort", () => {
      expect(labelDeElemento({ tag: "div" })).toBe("div");
    });

    it("truncates labels longer than 50 chars", () => {
      const longText = "a".repeat(80);
      const label = labelDeElemento({ text: longText });
      expect(label.length).toBeLessThanOrEqual(51);
      expect(label.endsWith("…")).toBe(true);
    });
  });

  describe("traducirEvento", () => {
    it("translates a navigate event into 'Abrir «URL»'", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "navigate",
          url: "https://banca.example.com/login",
        }),
      );
      expect(paso).toEqual({
        tipo: "navegar",
        origen: "grabado",
        descripcion: "Abrir «https://banca.example.com/login»",
      });
    });

    it("translates a click into 'Clic en «Ingresar»'", () => {
      const paso = traducirEvento(
        baseEvento({ type: "click", target: el({ text: "Ingresar" }) }),
      );
      expect(paso).toEqual({
        tipo: "clic",
        origen: "grabado",
        descripcion: "Clic en «Ingresar»",
      });
    });

    it("falls back to 'elemento' when target is null (no tag/aria/text)", () => {
      const paso = traducirEvento(
        baseEvento({ type: "click", target: null }),
      );
      expect(paso.descripcion).toBe("Clic en «elemento»");
    });

    it("uses the tag as a last-resort label when no other signals exist", () => {
      const paso = traducirEvento(
        baseEvento({ type: "click", target: { tag: "div" } }),
      );
      // text → aria → tag → "elemento" fallback chain: tag wins here.
      expect(paso.descripcion).toBe("Clic en «div»");
    });

    it("translates a non-password input into 'Escribir «VALUE» en «field»'", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "input",
          target: el({ text: "", aria: "Usuario", tag: "input" }),
          value: "admin",
          isPassword: false,
        }),
      );
      expect(paso).toEqual({
        tipo: "escribir",
        origen: "grabado",
        descripcion: "Escribir «admin» en «Usuario»",
      });
    });

    it("masks password events: never leaks the plain value", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "input",
          target: el({
            text: "",
            aria: "Contraseña",
            tag: "input",
          }),
          value: "super-secret-password",
          isPassword: true,
        }),
      );
      expect(paso.tipo).toBe("escribir");
      expect(paso.origen).toBe("grabado");
      expect(paso.descripcion).toContain(PASSWORD_MASK);
      expect(paso.descripcion).toContain("credencial");
      expect(paso.descripcion).toContain("Contraseña");
      // SECURITY: el valor en claro NUNCA debe aparecer en la descripcion.
      expect(paso.descripcion).not.toContain("super-secret-password");
    });

    it("password masking still works when caller passes value=null defensively", () => {
      // El init-script SIEMPRE manda value=null para passwords, pero
      // isPassword=true. El traductor debe seguir enmascarando.
      const paso = traducirEvento(
        baseEvento({
          type: "change",
          target: el({ aria: "Contraseña", tag: "input" }),
          value: null,
          isPassword: true,
        }),
      );
      expect(paso.descripcion).toContain(PASSWORD_MASK);
      expect(paso.descripcion).not.toContain("null");
    });

    it("translates submit events into 'Enviar formulario'", () => {
      const paso = traducirEvento(
        baseEvento({ type: "submit", target: el() }),
      );
      expect(paso).toEqual({
        tipo: "clic",
        origen: "grabado",
        descripcion: "Enviar formulario",
      });
    });

    it("translates wait events into 'Esperar X.Xs' with auto origin", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "wait",
          target: null,
          value: null,
          deltaFromPreviousMs: 1850,
        }),
      );
      expect(paso).toEqual({
        tipo: "esperar",
        origen: "auto",
        descripcion: "Esperar 1.9s",
      });
    });

    it("wait with very large delta formats with one decimal", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "wait",
          target: null,
          deltaFromPreviousMs: 12_345,
        }),
      );
      expect(paso.descripcion).toBe("Esperar 12.3s");
    });

    it("translates keydown into a generic step", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "keydown",
          target: el({ text: "", aria: "Usuario" }),
        }),
      );
      expect(paso.tipo).toBe("generico");
      expect(paso.origen).toBe("grabado");
      expect(paso.descripcion).toBe("Tecla en «Usuario»");
    });

    it("input with empty value renders empty «» placeholder (no crash)", () => {
      const paso = traducirEvento(
        baseEvento({
          type: "input",
          target: el({ text: "", aria: "Buscar" }),
          value: "",
        }),
      );
      expect(paso.descripcion).toBe("Escribir «» en «Buscar»");
    });

    it("navigate falls back to empty URL when url is missing", () => {
      const paso = traducirEvento(
        baseEvento({ type: "navigate" }),
      );
      expect(paso.descripcion).toBe("Abrir «»");
    });
  });
});
