import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  describe("hashPassword", () => {
    it("should return a hashed string for a plain password", async () => {
      const hash = await hashPassword("plain123");
      expect(hash).toBeDefined();
      expect(hash).not.toBe("plain123");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should produce different hashes for the same password due to salt", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for matching password and hash", async () => {
      const hash = await hashPassword("correctpassword");
      const isValid = await verifyPassword("correctpassword", hash);
      expect(isValid).toBe(true);
    });

    it("should return false for non-matching password", async () => {
      const hash = await hashPassword("correctpassword");
      const isValid = await verifyPassword("wrongpassword", hash);
      expect(isValid).toBe(false);
    });
  });
});
