import { describe, it, expect } from "vitest";
import { getModule, getModuleIds, getAllModules } from "../../../src/engines/xray/registry.js";

describe("registry", () => {
  it("has all three inbound modules", () => {
    const ids = getModuleIds();
    expect(ids).toContain("reality");
    expect(ids).toContain("vless-ws");
    expect(ids).toContain("vless-grpc");
    expect(ids).toHaveLength(3);
  });

  it("getAllModules returns 3 modules with labels", () => {
    const modules = getAllModules();
    expect(modules).toHaveLength(3);
    for (const mod of modules) {
      expect(mod.id).toBeTruthy();
      expect(mod.label).toBeTruthy();
      expect(typeof mod.build).toBe("function");
    }
  });

  it("getModule returns a module by id", () => {
    const mod = getModule("reality");
    expect(mod.id).toBe("reality");
    expect(mod.label).toContain("Reality");
  });

  it("getModule throws for unknown id", () => {
    expect(() => getModule("unknown")).toThrow("Unknown inbound module");
  });
});
