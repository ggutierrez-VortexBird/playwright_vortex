/**
 * Tests for lib/worker/auto-repair.ts (HU-G15).
 *
 * Verifies:
 *   - tryWithReparacionTs returns the principal result on first try.
 *   - tryWithReparacionTs falls back to respaldos when the principal fails.
 *   - tryWithReparacionTs sets selfHealed=true when usedIndex > 0.
 *   - tryWithReparacionTs sets detalleReparacion="se usó respaldo por <strategy>".
 *   - tryWithReparacionTs returns ok=false when all candidates fail.
 *   - countReparadosFromPasos counts only selfHealed=true.
 *   - The injected JS source contains the expected function structure.
 */

import {
  tryWithReparacionTs,
  countReparadosFromPasos,
  TRY_WITH_REPARACION_SOURCE,
  type SelectorCandidate,
} from "@/lib/worker/auto-repair";

/**
 * Mock page that delegates every strategy's click/fill to ONE function
 * so we can simulate "fail first N calls, succeed on N+1" without
 * distinguishing which strategy was used.
 */
function mockPageWithCounter(
  counter: { calls: number; failFirst: number; value?: unknown },
): any {
  const exec = () => {
    counter.calls++;
    if (counter.calls <= counter.failFirst) {
      return Promise.reject(new Error(`mock-fail-${counter.calls}`));
    }
    return Promise.resolve(counter.value ?? "ok");
  };
  const mkLocator = () => ({
    click: exec,
    fill: exec,
  });
  return {
    locator: mkLocator,
    getByTestId: mkLocator,
    getByRole: mkLocator,
    getByLabel: mkLocator,
    getByText: mkLocator,
  };
}

describe("tryWithReparacionTs — HU-G15", () => {
  it("returns the principal result on first try (usedIndex=0, selfHealed=false)", async () => {
    const counter = { calls: 0, failFirst: 0, value: "ok" };
    const page = mockPageWithCounter(counter);
    const candidates: SelectorCandidate[] = [
      { strategy: "testid", value: "submit" },
      { strategy: "css", value: "body > button" },
    ];
    const action = (loc: any) => loc.click();

    const r = await tryWithReparacionTs(page, candidates, action);
    expect(r.ok).toBe(true);
    expect(r.usedIndex).toBe(0);
    expect(r.selfHealed).toBe(false);
    expect(r.detalleReparacion).toBeNull();
    expect(r.value).toBe("ok");
    expect(r.error).toBeNull();
  });

  it("falls back to respaldo when the principal fails", async () => {
    const counter = { calls: 0, failFirst: 1, value: "ok-via-css" };
    const page = mockPageWithCounter(counter);
    const candidates: SelectorCandidate[] = [
      { strategy: "testid", value: "submit" },
      { strategy: "css", value: "body > button" },
    ];
    const action = (loc: any) => loc.fill("x");

    const r = await tryWithReparacionTs(page, candidates, action);
    expect(r.ok).toBe(true);
    expect(r.usedIndex).toBe(1);
    expect(r.selfHealed).toBe(true);
    expect(r.detalleReparacion).toBe('se usó respaldo por css');
    expect(r.value).toBe("ok-via-css");
  });

  it("returns ok=false when all candidates fail", async () => {
    const counter = { calls: 0, failFirst: 99 }; // always fail
    const page = mockPageWithCounter(counter);
    const candidates: SelectorCandidate[] = [
      { strategy: "testid", value: "x" },
      { strategy: "css", value: "body > button" },
      { strategy: "text", value: "Submit" },
    ];
    const action = (loc: any) => loc.click();

    const r = await tryWithReparacionTs(page, candidates, action);
    expect(r.ok).toBe(false);
    expect(r.usedIndex).toBe(-1);
    expect(r.selfHealed).toBe(false);
    expect(r.error?.message).toMatch(/Ningún selector/);
  });

  it("marks selfHealed=true when ANY respaldo is used (usedIndex > 0)", async () => {
    const counter = { calls: 0, failFirst: 2, value: "ok-3rd" };
    const page = mockPageWithCounter(counter);
    const candidates: SelectorCandidate[] = [
      { strategy: "testid", value: "x" },
      { strategy: "role", value: "button" },
      { strategy: "css", value: "body > button" },
    ];
    const action = (loc: any) => loc.click();

    const r = await tryWithReparacionTs(page, candidates, action);
    expect(r.usedIndex).toBe(2);
    expect(r.selfHealed).toBe(true);
    expect(r.detalleReparacion).toBe('se usó respaldo por css');
  });

  it("propagates the value from action(locator)", async () => {
    const counter = { calls: 0, failFirst: 0, value: { clicked: true } };
    const page = mockPageWithCounter(counter);
    const candidates: SelectorCandidate[] = [
      { strategy: "role", value: "button" },
    ];
    const action = (loc: any) => loc.click();
    const r = await tryWithReparacionTs(page, candidates, action);
    expect(r.value).toEqual({ clicked: true });
  });

  it("uses page.getByTestId for testid strategy", async () => {
    const calls: string[] = [];
    const page: any = {
      locator: () => ({
        click: () => {
          calls.push("locator");
          return Promise.resolve("css-ok");
        },
        fill: () => Promise.reject(new Error("no")),
      }),
      getByTestId: () => ({
        click: () => {
          calls.push("getByTestId");
          return Promise.resolve("tid-ok");
        },
        fill: () => Promise.reject(new Error("no")),
      }),
      getByRole: () => ({
        click: () => {
          calls.push("getByRole");
          return Promise.resolve("role-ok");
        },
        fill: () => Promise.reject(new Error("no")),
      }),
      getByLabel: () => ({
        click: () => {
          calls.push("getByLabel");
          return Promise.resolve("aria-ok");
        },
        fill: () => Promise.reject(new Error("no")),
      }),
      getByText: () => ({
        click: () => {
          calls.push("getByText");
          return Promise.resolve("text-ok");
        },
        fill: () => Promise.reject(new Error("no")),
      }),
    };
    const candidates: SelectorCandidate[] = [{ strategy: "testid", value: "x" }];
    await tryWithReparacionTs(page, candidates, (l: any) => l.click());
    expect(calls).toEqual(["getByTestId"]);
  });
});

describe("countReparadosFromPasos — HU-G15", () => {
  it("returns 0 when no selfHealed steps", () => {
    expect(
      countReparadosFromPasos([
        { selfHealed: false },
        { selfHealed: false },
      ]),
    ).toBe(0);
  });

  it("counts only selfHealed=true steps", () => {
    expect(
      countReparadosFromPasos([
        { selfHealed: true },
        { selfHealed: false },
        { selfHealed: true },
        { selfHealed: true },
      ]),
    ).toBe(3);
  });

  it("handles empty array", () => {
    expect(countReparadosFromPasos([])).toBe(0);
  });
});

describe("TRY_WITH_REPARACION_SOURCE — HU-G15", () => {
  it("contains the expected function declaration", () => {
    expect(TRY_WITH_REPARACION_SOURCE).toContain("async function tryWithReparacion");
  });

  it("handles all 6 strategies in buildLocator", () => {
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'testid'");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'role'");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'id'");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'aria-label'");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'text'");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("'css'");
  });

  it("sets selfHealed flag based on usedIndex", () => {
    expect(TRY_WITH_REPARACION_SOURCE).toContain("selfHealed: i > 0");
    expect(TRY_WITH_REPARACION_SOURCE).toContain("se usó respaldo por ");
  });
});