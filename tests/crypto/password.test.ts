import { describe, it, expect } from "vitest";
import { generatePassword } from "../../src/crypto/password.js";

describe("generatePassword", () => {
  it("returns base64url of 24 random bytes (no padding)", () => {
    const pw = generatePassword();
    expect(pw).not.toMatch(/=+$/);
    expect(Buffer.from(pw, "base64url")).toHaveLength(24);
  });

  it("respects requested byte length", () => {
    expect(Buffer.from(generatePassword(16), "base64url")).toHaveLength(16);
  });

  it("generates unique values", () => {
    const set = new Set(Array.from({ length: 500 }, () => generatePassword()));
    expect(set.size).toBe(500);
  });
});
