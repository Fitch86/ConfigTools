import { describe, it, expect } from "vitest";
import { formatJson, formatJsonString } from "../../src/format/json.js";

describe("formatJson", () => {
  it("sorts object keys alphabetically", () => {
    const result = formatJson({ z: 1, a: 2, m: 3 });
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed as Record<string, unknown>)).toEqual(["a", "m", "z"]);
  });

  it("is idempotent (format ∘ format === format)", () => {
    const obj = { outbounds: [{ tag: "direct", protocol: "freedom" }], inbounds: [{ port: 443, protocol: "vless", tag: "reality" }], log: { loglevel: "Warning" } };
    const first = formatJson(obj);
    const second = formatJsonString(first);
    expect(first).toBe(second);
  });

  it("handles nested objects with sorted keys", () => {
    const result = formatJson({ streamSettings: { security: "reality", network: "raw" } });
    const parsed = JSON.parse(result) as { streamSettings: Record<string, unknown> };
    expect(Object.keys(parsed.streamSettings)).toEqual(["network", "security"]);
  });

  it("handles arrays (order preserved)", () => {
    const result = formatJson({ rules: ["z", "a", "m"] });
    const parsed = JSON.parse(result) as { rules: string[] };
    expect(parsed.rules).toEqual(["z", "a", "m"]);
  });

  it("handles empty objects and arrays", () => {
    expect(formatJson({})).toBe("{}");
    expect(formatJson([])).toBe("[]");
    expect(formatJson({ arr: [] })).toContain("[]");
  });

  it("handles null and primitive values", () => {
    const result = formatJson({ n: null, b: true, i: 42, s: "hello" });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed).toEqual({ b: true, i: 42, n: null, s: "hello" });
  });
});

describe("formatJsonString", () => {
  it("parses and reformats a JSON string", () => {
    const raw = '{"z":1,"a":2}';
    const formatted = formatJsonString(raw);
    expect(formatted.indexOf('"a"')).toBeLessThan(formatted.indexOf('"z"'));
  });

  it("throws on invalid JSON", () => {
    expect(() => formatJsonString("{invalid")).toThrow();
  });
});
