import { describe, it, expect } from "vitest";
import { generateUuid, UUID_REGEX } from "../../src/crypto/uuid.js";

describe("generateUuid", () => {
  it("produces an RFC4122 v4 UUID", () => {
    const id = generateUuid();
    expect(id).toMatch(UUID_REGEX);
    expect(id).toHaveLength(36);
  });

  it("the version nibble is 4", () => {
    expect(generateUuid()[14]).toBe("4");
  });

  it("the variant nibble is 8, 9, a, or b", () => {
    const v = generateUuid()[19];
    expect(["8", "9", "a", "b"]).toContain(v);
  });

  it("generates unique values", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateUuid()));
    expect(set.size).toBe(1000);
  });
});
