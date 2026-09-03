/**
 * Tests for lib/grabador/dom-utils.ts — shared DOM element serializer.
 *
 * HU-G5: el cliente envía {type:'pick', x, y} al worker, que llama
 * `page.evaluate(({x,y}) => elementFromPoint(x,y))` y serializa el
 * elemento con la misma forma que el init-script. Esta función es
 * la implementación Node-side que se inyecta como argumento a evaluate.
 */

import {
  serializeElement,
  serializeElementLite,
  toSelectorPrincipal,
  pickBestSelector,
  buildCssPath,
  isPasswordField,
  type SerializedElementFull,
} from "@/lib/grabador/dom-utils";

/**
 * Helper: crea un HTMLElement-like mock con getAttribute + tagName +
 * getBoundingClientRect controlados. Suficiente para que serializeElement
 * lea todos los campos sin tirar.
 */
function mockElement(opts: {
  tag?: string;
  id?: string;
  attrs?: Record<string, string>;
  text?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  parentChain?: Element[];
  previousSiblings?: Element[];
}): Element {
  const tag = opts.tag ?? "div";
  const attrs: Record<string, string | null> = { ...(opts.attrs ?? {}) };

  const mock: Partial<Element> = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    id: opts.id ?? "",
    textContent: opts.text ?? "",
    getAttribute: ((name: string) => attrs[name] ?? null) as Element["getAttribute"],
    getBoundingClientRect: (() => opts.bbox ?? null) as Element["getBoundingClientRect"],
  };

  // Parent chain for buildCssPath.
  let parent: Element | null = null;
  const chain = opts.parentChain ?? [];
  for (let i = chain.length - 1; i >= 0; i--) {
    if (i === chain.length - 1) {
      parent = chain[i];
    } else {
      (chain[i] as unknown as { parentElement: Element | null }).parentElement = chain[i + 1];
    }
  }
  if (chain.length > 0) {
    (mock as unknown as { parentElement: Element | null }).parentElement = chain[0];
  }

  // Previous siblings.
  let prev: Element | null = null;
  for (const sib of opts.previousSiblings ?? []) {
    if (!prev) prev = sib;
    else (sib as unknown as { previousElementSibling: Element | null }).previousElementSibling = prev;
    prev = sib;
  }
  if (opts.previousSiblings && opts.previousSiblings.length > 0) {
    (mock as unknown as { previousElementSibling: Element | null }).previousElementSibling =
      opts.previousSiblings[opts.previousSiblings.length - 1];
  }

  return mock as Element;
}

describe("dom-utils — serializeElement", () => {
  it("returns null when given a non-Element (nodeType !== 1)", () => {
    expect(serializeElement(null)).toBeNull();
    expect(serializeElement(undefined)).toBeNull();
    const notElement = { nodeType: 3 } as unknown as Element;
    expect(serializeElement(notElement)).toBeNull();
  });

  it("serializes a basic button with tag, text, role and bbox", () => {
    const el = mockElement({
      tag: "button",
      text: "Click me",
      attrs: {},
      bbox: { x: 10, y: 20, width: 100, height: 30 },
    });
    const out = serializeElement(el);
    expect(out).not.toBeNull();
    expect(out!.tag).toBe("button");
    expect(out!.role).toBe("button"); // role defaults to tag
    expect(out!.text).toBe("Click me");
    expect(out!.testId).toBe("");
    expect(out!.aria).toBe("");
    expect(out!.bbox).toEqual({ x: 10, y: 20, width: 100, height: 30 });
  });

  it("captures aria-label, name, id, and test-id", () => {
    const el = mockElement({
      tag: "input",
      id: "username",
      attrs: {
        "aria-label": "Username",
        "data-testid": "user-input",
        name: "user",
      },
    });
    const out = serializeElement(el)!;
    expect(out.tag).toBe("input");
    // FIX (HU-G14): `<input>` tiene implicit role 'textbox', ya no cae al tag.
    expect(out.role).toBe("textbox");
    expect(out.testId).toBe("user-input");
    expect(out.aria).toBe("Username"); // aria-label takes priority
    expect(out.name).toBe("user");
    // FIX (HU-G14): ahora `accessibleName` se computa siempre.
    expect(out.accessibleName).toBe("Username");
  });

  it("builds candidate selectors in priority order: testid, role, id, aria-label, name, text, css", () => {
    const el = mockElement({
      tag: "button",
      id: "submit-btn",
      attrs: {
        "data-testid": "btn-submit",
        "aria-label": "Submit form",
        name: "submit",
      },
      text: "Send",
    });
    const out = serializeElement(el)!;
    const strategies = out.candidates.map((c) => c.strategy);
    // FIX (HU-G14): `role` se emite siempre que exista role semantico,
    // en posicion 2 (entre testid e id). El codegen lo prefiere sobre
    // aria-label y name porque es mas estable.
    expect(strategies).toEqual([
      "testid",
      "role",
      "id",
      "aria-label",
      "name",
      "text",
      "css",
    ]);
    expect(out.candidates[0]).toEqual({
      strategy: "testid",
      value: `[data-testid="btn-submit"]`,
    });
    // FIX: role candidate incluye `name` con el accessible name
    // computado. Con aria-label explicito gana el aria-label sobre
    // el textContent ("Submit form" vs "Send").
    expect(out.candidates[1]).toEqual({
      strategy: "role",
      value: "button",
      name: "Submit form",
    });
    expect(out.candidates[2]).toEqual({
      strategy: "id",
      value: `#submit-btn`,
    });
    expect(out.candidates[3]).toEqual({
      strategy: "aria-label",
      value: `[aria-label="Submit form"]`,
    });
    expect(out.candidates[4]).toEqual({
      strategy: "name",
      value: `[name="submit"]`,
    });
    expect(out.candidates[5]).toEqual({
      strategy: "text",
      value: "Send",
    });
    expect(out.candidates[6].strategy).toBe("css");
  });

  it("skips text candidate when text is >= 30 chars (avoid unwieldy selectors)", () => {
    const el = mockElement({
      tag: "button",
      text: "A".repeat(50),
    });
    const out = serializeElement(el)!;
    const strategies = out.candidates.map((c) => c.strategy);
    expect(strategies).not.toContain("text");
  });

  it("escapes double-quotes in testId / aria-label / name", () => {
    const el = mockElement({
      tag: "input",
      attrs: {
        "data-testid": `weird"id`,
        "aria-label": `say "hi"`,
      },
    });
    const out = serializeElement(el)!;
    expect(out.candidates[0].value).toBe(`[data-testid="weird\\"id"]`);
    // FIX: candidates ahora tiene `role` en pos 1 entre testid y aria-label
    // (input sin type → implicit role 'textbox').
    expect(out.candidates[1].value).toBe("textbox");
    expect(out.candidates[2].value).toBe(`[aria-label="say \\"hi\\""]`);
  });

  it("uses role attribute when present, falls back to tag", () => {
    const elWithRole = mockElement({
      tag: "div",
      attrs: { role: "button" },
    });
    expect(serializeElement(elWithRole)!.role).toBe("button");

    const elWithoutRole = mockElement({ tag: "span" });
    expect(serializeElement(elWithoutRole)!.role).toBe("span");
  });

  it("truncates text to 50 chars", () => {
    const el = mockElement({ tag: "p", text: "B".repeat(100) });
    expect(serializeElement(el)!.text).toBe("B".repeat(50));
  });

  it("returns bbox=null when getBoundingClientRect throws", () => {
    const el = {
      nodeType: 1,
      nodeName: "DIV",
      tagName: "DIV",
      id: "",
      textContent: "",
      getAttribute: () => null,
      getBoundingClientRect: () => {
        throw new Error("no layout");
      },
    } as unknown as Element;
    const out = serializeElement(el)!;
    expect(out.bbox).toBeNull();
  });
});

describe("dom-utils — serializeElementLite", () => {
  it("returns null for non-Element inputs", () => {
    expect(serializeElementLite(null)).toBeNull();
    expect(serializeElementLite(undefined)).toBeNull();
  });

  it("produces the shape persisted in PasoGrabado.selectorPrincipal", () => {
    const el = mockElement({
      tag: "button",
      text: "OK",
      attrs: { "aria-label": "OK", "data-testid": "btn-ok" },
    });
    expect(serializeElementLite(el)).toEqual({
      tag: "button",
      text: "OK",
      aria: "OK",
      testId: "btn-ok",
    });
  });

  it("emits null for missing attributes (not empty string)", () => {
    const el = mockElement({ tag: "div" });
    expect(serializeElementLite(el)).toEqual({
      tag: "div",
      text: null,
      aria: null,
      testId: null,
    });
  });
});

describe("dom-utils — toSelectorPrincipal", () => {
  it("maps a SerializedElementFull to the lite shape", () => {
    const full: SerializedElementFull = {
      tag: "input",
      role: "input",
      text: "",
      testId: "user",
      aria: "Username",
      name: "user",
      accessibleName: "Username",
      candidates: [],
      bbox: null,
    };
    expect(toSelectorPrincipal(full)).toEqual({
      tag: "input",
      text: null, // empty string is normalized to null
      aria: "Username",
      testId: "user",
    });
  });

  it("returns null for null input", () => {
    expect(toSelectorPrincipal(null)).toBeNull();
  });
});

describe("dom-utils — pickBestSelector", () => {
  const candidates: Array<{ strategy: string; value: string }> = [
    { strategy: "css", value: "html > body > div > button" },
    { strategy: "name", value: "[name='send']" },
    { strategy: "aria-label", value: "[aria-label='Submit']" },
    { strategy: "testid", value: "[data-testid='submit']" },
  ];

  it("prefers testid over everything else", () => {
    expect(pickBestSelector(candidates)).toEqual({
      strategy: "testid",
      value: "[data-testid='submit']",
    });
  });

  it("falls back through the priority list when no testid", () => {
    const noTestid = candidates.filter((c) => c.strategy !== "testid");
    expect(pickBestSelector(noTestid)).toEqual({
      strategy: "aria-label",
      value: "[aria-label='Submit']",
    });
  });

  it("returns css when nothing better is available", () => {
    const onlyCss = [{ strategy: "css", value: "html > body" }];
    expect(pickBestSelector(onlyCss)).toEqual({
      strategy: "css",
      value: "html > body",
    });
  });

  it("returns null when candidates is empty", () => {
    expect(pickBestSelector([])).toBeNull();
  });
});

describe("dom-utils — buildCssPath", () => {
  it("returns '' for non-Element inputs", () => {
    expect(buildCssPath({} as Element)).toBe("");
  });

  it("uses #id when present and stops walking the tree", () => {
    const parent = mockElement({ tag: "div", id: "root" });
    const child = mockElement({
      tag: "button",
      parentChain: [parent],
    });
    // Parent had id="root", so we're in a chain.
    expect(buildCssPath(child)).toContain("#root");
  });
});

describe("dom-utils — isPasswordField", () => {
  it("returns true for input[type=password]", () => {
    const el = {
      type: "password",
    } as unknown as Element;
    expect(isPasswordField(el)).toBe(true);
  });

  it("returns false for input[type=text]", () => {
    const el = { type: "text" } as unknown as Element;
    expect(isPasswordField(el)).toBe(false);
  });

  it("returns false for null / undefined / missing type", () => {
    expect(isPasswordField(null)).toBe(false);
    expect(isPasswordField({} as Element)).toBe(false);
  });

  it("is case-insensitive (PASSWORD uppercase)", () => {
    const el = { type: "PASSWORD" } as unknown as Element;
    expect(isPasswordField(el)).toBe(true);
  });
});
