import {
  normalizeSelectorText,
  isUsableTextSelector,
  implicitRoleFor,
  resolveRole,
  pickBestSelector,
  TEXT_SELECTOR_MIN_LEN,
  TEXT_SELECTOR_MAX_LEN,
} from "@/lib/grabador/dom-utils";

describe("lib/grabador/dom-utils", () => {
  describe("normalizeSelectorText", () => {
    it("retorna '' para entradas no-string", () => {
      expect(normalizeSelectorText(null)).toBe("");
      expect(normalizeSelectorText(undefined)).toBe("");
    });

    it("colapsa whitespace múltiple a un solo espacio y trimea", () => {
      expect(normalizeSelectorText("  foo   bar  ")).toBe("foo bar");
    });

    it("elimina zero-width characters", () => {
      expect(normalizeSelectorText("foo\u200bbar")).toBe("foobar");
    });

    it("reemplaza caracteres de control por espacio", () => {
      expect(normalizeSelectorText("foo\u0000bar")).toBe("foo bar");
    });

    it("reemplaza NBSP y narrow NBSP por espacio", () => {
      expect(normalizeSelectorText("foo\u00a0bar")).toBe("foo bar");
      expect(normalizeSelectorText("foo\u202fbar")).toBe("foo bar");
    });
  });

  describe("isUsableTextSelector", () => {
    it("rechaza textos demasiado cortos", () => {
      expect(isUsableTextSelector("ab")).toBe(false);
    });

    it("rechaza textos demasiado largos", () => {
      const long = "a".repeat(TEXT_SELECTOR_MAX_LEN);
      expect(isUsableTextSelector(long)).toBe(false);
    });

    it("rechaza textos con pegado lowercase+uppercase (concatenación)", () => {
      expect(isUsableTextSelector("PerúJulián")).toBe(false);
    });

    it("acepta textos de longitud válida sin pegado", () => {
      expect(isUsableTextSelector("Buscar")).toBe(true);
    });

    it("retorna false para null/undefined", () => {
      expect(isUsableTextSelector(null)).toBe(false);
      expect(isUsableTextSelector(undefined)).toBe(false);
    });
  });

  describe("implicitRoleFor", () => {
    it("input[type=search] → searchbox", () => {
      expect(implicitRoleFor("input", "search")).toBe("searchbox");
    });

    it("input[type=checkbox] → checkbox", () => {
      expect(implicitRoleFor("input", "checkbox")).toBe("checkbox");
    });

    it("input[type=email] → textbox", () => {
      expect(implicitRoleFor("input", "email")).toBe("textbox");
    });

    it("input[type=password] → null (campo sensible)", () => {
      expect(implicitRoleFor("input", "password")).toBeNull();
    });

    it("input[type=hidden] → null", () => {
      expect(implicitRoleFor("input", "hidden")).toBeNull();
    });

    it("input[type=submit] → button", () => {
      expect(implicitRoleFor("input", "submit")).toBe("button");
    });

    it("input sin type → textbox", () => {
      expect(implicitRoleFor("input")).toBe("textbox");
    });

    it("input con type desconocido → textbox (fallback)", () => {
      expect(implicitRoleFor("input", "weird")).toBe("textbox");
    });

    it("button → button", () => {
      expect(implicitRoleFor("button")).toBe("button");
    });

    it("select → combobox", () => {
      expect(implicitRoleFor("select")).toBe("combobox");
    });

    it("textarea → textbox", () => {
      expect(implicitRoleFor("textarea")).toBe("textbox");
    });

    it("a → link", () => {
      expect(implicitRoleFor("a")).toBe("link");
    });

    it("nav → navigation", () => {
      expect(implicitRoleFor("nav")).toBe("navigation");
    });

    it("h1..h6 → heading", () => {
      expect(implicitRoleFor("h1")).toBe("heading");
      expect(implicitRoleFor("h6")).toBe("heading");
    });

    it("main → main", () => {
      expect(implicitRoleFor("main")).toBe("main");
    });

    it("tag desconocido → null", () => {
      expect(implicitRoleFor("div")).toBeNull();
    });

    it("tag null/undefined → null", () => {
      expect(implicitRoleFor(null)).toBeNull();
      expect(implicitRoleFor(undefined)).toBeNull();
    });
  });

  describe("resolveRole", () => {
    it("explicit role gana sobre implícito", () => {
      expect(resolveRole("input", "searchbox", "text")).toBe("searchbox");
    });

    it("cae al implícito si no hay explícito", () => {
      expect(resolveRole("button", null)).toBe("button");
    });

    it("explicit vacío cae al implícito", () => {
      expect(resolveRole("a", "", null)).toBe("link");
    });

    it("sin role semántico → null", () => {
      expect(resolveRole("div", null)).toBeNull();
    });
  });

  describe("pickBestSelector", () => {
    it("elige testid si está presente (mayor prioridad)", () => {
      const picked = pickBestSelector([
        { strategy: "css", value: "html > body" },
        { strategy: "testid", value: "[data-testid='x']" },
        { strategy: "text", value: "Click me" },
      ]);
      expect(picked).toEqual({ strategy: "testid", value: "[data-testid='x']" });
    });

    it("elige role si no hay testid", () => {
      const picked = pickBestSelector([
        { strategy: "text", value: "Click me" },
        { strategy: "role", value: "button" },
      ]);
      expect(picked?.strategy).toBe("role");
    });

    it("elige id si no hay testid ni role", () => {
      const picked = pickBestSelector([
        { strategy: "text", value: "Click me" },
        { strategy: "id", value: "#submit" },
      ]);
      expect(picked?.strategy).toBe("id");
    });

    it("elige aria-label si solo está ese y css/text", () => {
      const picked = pickBestSelector([
        { strategy: "css", value: "html > body" },
        { strategy: "aria-label", value: "[aria-label='Submit']" },
      ]);
      expect(picked?.strategy).toBe("aria-label");
    });

    it("elige text como última opción semántica", () => {
      const picked = pickBestSelector([
        { strategy: "text", value: "Submit" },
      ]);
      expect(picked).toEqual({ strategy: "text", value: "Submit" });
    });

    it("cae a css como último recurso", () => {
      const picked = pickBestSelector([
        { strategy: "css", value: "html > body > button" },
      ]);
      expect(picked).toEqual({ strategy: "css", value: "html > body > button" });
    });

    it("retorna null para lista vacía", () => {
      expect(pickBestSelector([])).toBeNull();
    });
  });

  describe("constants", () => {
    it("TEXT_SELECTOR_MIN_LEN es 3", () => {
      expect(TEXT_SELECTOR_MIN_LEN).toBe(3);
    });

    it("TEXT_SELECTOR_MAX_LEN es 30", () => {
      expect(TEXT_SELECTOR_MAX_LEN).toBe(30);
    });
  });
});
