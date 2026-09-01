/**
 * Tests for lib/grabador/auto-wait.ts — HU-G4.
 *
 * Covers the threshold-based gap detection that creates "Esperar X.Xs"
 * steps between user-driven events.
 */

import {
  detectarAutoWait,
  WAIT_THRESHOLD_MS,
} from "@/lib/grabador/auto-wait";

describe("lib/grabador/auto-wait", () => {
  describe("WAIT_THRESHOLD_MS", () => {
    it("is 300ms (spec requirement)", () => {
      expect(WAIT_THRESHOLD_MS).toBe(300);
    });
  });

  describe("detectarAutoWait", () => {
    it("returns null when prevTimestamp is null (first event of session)", () => {
      expect(detectarAutoWait(null, 1000)).toBeNull();
    });

    it("returns null when gap is below threshold", () => {
      // 100ms < 300ms threshold
      expect(detectarAutoWait(1000, 1100)).toBeNull();
    });

    it("returns null when gap equals threshold (strictly > required)", () => {
      // Exactly 300ms should NOT count — only >300ms triggers.
      expect(detectarAutoWait(1000, 1300)).toBeNull();
    });

    it("returns a wait event when gap is just above threshold", () => {
      // 301ms > 300ms should trigger.
      const result = detectarAutoWait(1000, 1301);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("wait");
      expect(result!.target).toBeNull();
      expect(result!.deltaFromPreviousMs).toBe(301);
    });

    it("captures the full delta for typical server delays (~1.5s)", () => {
      const result = detectarAutoWait(1_700_000_000_000, 1_700_000_001_500);
      expect(result).not.toBeNull();
      expect(result!.deltaFromPreviousMs).toBe(1500);
      expect(result!.timestamp).toBe(1_700_000_001_500);
    });

    it("handles very large gaps (idle user for several minutes)", () => {
      const result = detectarAutoWait(1000, 65_000);
      expect(result!.deltaFromPreviousMs).toBe(64_000);
    });

    it("accepts a custom threshold", () => {
      // With threshold=1000, a 500ms gap is NOT a wait.
      expect(detectarAutoWait(1000, 1500, 1000)).toBeNull();
      // But a 1500ms gap IS a wait.
      const result = detectarAutoWait(1000, 2500, 1000);
      expect(result).not.toBeNull();
      expect(result!.deltaFromPreviousMs).toBe(1500);
    });
  });
});
