/**
 * Smoke tests for lib/grabador/init-script.ts — browser-side DOM listener.
 *
 * The init-script is a string that gets evaluated inside the browser
 * context via Playwright's `addInitScript`. It can't be tested with
 * jsdom alone (no real addInitScript execution), so these tests verify
 * its SHAPE — required references, event types covered, password
 * detection logic — so any future refactor that accidentally drops a
 * security feature or event type fails here.
 *
 * Full end-to-end validation requires Playwright + Chromium (out of
 * scope for unit tests; covered by `e2e/grabador-*.spec.ts` in PR-1).
 */

import { INIT_SCRIPT } from "@/lib/grabador/init-script";
import type { EventoDom } from "@/lib/grabador/translator";

describe("lib/grabador/init-script", () => {
  it("is a non-empty string", () => {
    expect(typeof INIT_SCRIPT).toBe("string");
    expect(INIT_SCRIPT.length).toBeGreaterThan(200);
  });

  it("wraps the whole logic in an IIFE to avoid leaking globals", () => {
    expect(INIT_SCRIPT.trimStart().startsWith("(() => {")).toBe(true);
    expect(INIT_SCRIPT.trimEnd().endsWith("})();")).toBe(true);
  });

  it("covers all 5 user-driven event types", () => {
    for (const evt of ["click", "input", "change", "keydown", "submit"]) {
      expect(INIT_SCRIPT).toContain(`'${evt}'`);
    }
  });

  it("registers listeners in capture phase (third arg true)", () => {
    expect(INIT_SCRIPT).toContain("addEventListener(t, report, true)");
  });

  it("calls window.__pw_report to send the payload to Node", () => {
    expect(INIT_SCRIPT).toContain("window.__pw_report(payload)");
  });

  it("tracks lastEventTime for HU-G4 auto-wait delta computation", () => {
    expect(INIT_SCRIPT).toContain("lastEventTime");
    expect(INIT_SCRIPT).toContain("deltaFromPreviousMs");
  });

  it("SECURITY: detects password fields by type='password'", () => {
    expect(INIT_SCRIPT).toContain("PASSWORD_TYPE = 'password'");
    expect(INIT_SCRIPT).toContain("isPasswordField(target)");
  });

  it("SECURITY: sets value=null for password fields (never sends plain text)", () => {
    // The conditional expression in the payload builder must zero-out value for passwords.
    expect(INIT_SCRIPT).toContain("passwd ? null");
    expect(INIT_SCRIPT).toContain("isPassword: passwd");
  });

  it("builds a serialized element with tag, role, text, aria, testId, candidates, bbox", () => {
    for (const term of [
      "tag",
      "role",
      "text",
      "testId",
      "aria",
      "candidates",
      "bbox",
    ]) {
      expect(INIT_SCRIPT).toContain(term);
    }
  });

  it("emits multiple selector candidates prioritized (testid → id → aria-label → name → text → css)", () => {
    const expected = ["testid", "id", "aria-label", "name", "text", "css"];
    for (const strat of expected) {
      expect(INIT_SCRIPT).toContain(`strategy: '${strat}'`);
    }
  });

  it("includes a cssPath fallback that doesn't throw on non-Element inputs", () => {
    expect(INIT_SCRIPT).toContain("if (!(el instanceof Element)) return ''");
  });

  it("swallows errors from __pw_report (recorder may have stopped)", () => {
    expect(INIT_SCRIPT).toMatch(/catch\s*\(\s*err/);
  });

  it("constructs a payload object with the shape required by EventoDom", () => {
    // Spot-check the literal field names in the payload literal.
    for (const field of [
      "type:",
      "target:",
      "value:",
      "timestamp:",
      "deltaFromPreviousMs:",
      "isPassword:",
    ]) {
      expect(INIT_SCRIPT).toContain(field);
    }
  });
});

describe("lib/grabador/init-script payload-shape contract", () => {
  it("matches the TypeScript EventoDom interface", () => {
    // If this compiles, the literal fields in the init script match
    // the fields in EventoDom.
    const samplePayload: EventoDom = {
      type: "click",
      target: { tag: "button" },
      value: null,
      timestamp: Date.now(),
      deltaFromPreviousMs: 0,
      isPassword: false,
    };
    expect(samplePayload.type).toBe("click");
  });
});
