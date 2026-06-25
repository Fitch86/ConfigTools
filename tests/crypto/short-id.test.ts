import { describe, it, expect } from "vitest";
import {
  generateShortIds,
  SHORTID_REGEX,
  isValidShortId,
} from "../../src/crypto/short-id.js";

describe("shortIds", () => {
  it("default generates one 8-hex-char id", () => {
    const ids = generateShortIds();
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}$/);
  });

  it("respects requested count and byte length", () => {
    const ids = generateShortIds({ count: 3, bytes: 4 });
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("bytes=8 produces a 16-hex-char id (the max)", () => {
    expect(generateShortIds({ count: 1, bytes: 8 })[0]).toMatch(
      /^[0-9a-f]{16}$/
    );
  });

  it("can include the empty string (match-any) sentinel", () => {
    const ids = generateShortIds({ includeEmpty: true });
    expect(ids).toContain("");
  });

  it("isValidShortId accepts empty string and even-length hex up to 16", () => {
    expect(isValidShortId("")).toBe(true);
    expect(isValidShortId("ab")).toBe(true);
    expect(isValidShortId("0123456789abcdef")).toBe(true);
    expect(isValidShortId("abc")).toBe(false); // odd length
    expect(isValidShortId("0123456789abcdef0")).toBe(false); // >16
    expect(isValidShortId("xyz0")).toBe(false); // non-hex
  });

  it("SHORTID_REGEX matches even hex 0..16 chars", () => {
    expect(SHORTID_REGEX.test("abab")).toBe(true);
    expect(SHORTID_REGEX.test("a")).toBe(false);
  });
});
