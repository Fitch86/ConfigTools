import { describe, it, expect } from "vitest";
import { buildSkeleton, type RoutingPreset } from "../../../src/engines/xray/skeleton.js";

describe("buildSkeleton", () => {
  it("builds a minimal skeleton with defaults", () => {
    const skeleton = buildSkeleton();
    expect(skeleton.log?.loglevel).toBe("Warning");
    expect(skeleton.outbounds).toHaveLength(1);
    expect(skeleton.outbounds[0].tag).toBe("direct");
    expect(skeleton.outbounds[0].protocol).toBe("freedom");
    expect(skeleton.inbounds).toBeUndefined();
    expect(skeleton.routing).toBeUndefined();
    expect(skeleton.dns).toBeUndefined();
  });

  it("respects custom log level", () => {
    const skeleton = buildSkeleton({ logLevel: "debug" });
    expect(skeleton.log?.loglevel).toBe("Debug");
  });

  it("adds routing + dns + block outbound for block-ads-cn preset", () => {
    const skeleton = buildSkeleton({ routingPreset: "block-ads-cn" });
    expect(skeleton.routing).toBeDefined();
    expect(skeleton.routing!.rules.length).toBeGreaterThanOrEqual(4);
    expect(skeleton.routing!.domainStrategy).toBe("IPIfNonMatch");
    expect(skeleton.dns).toBeDefined();
    expect(skeleton.dns!.servers.length).toBeGreaterThanOrEqual(2);
    expect(skeleton.outbounds).toHaveLength(3);
    const tags = skeleton.outbounds.map(o => o.tag);
    expect(tags).toContain("direct");
    expect(tags).toContain("block");
    expect(tags).toContain("dns");
  });

  it("none preset has no routing", () => {
    const skeleton = buildSkeleton({ routingPreset: "none" });
    expect(skeleton.routing).toBeUndefined();
    expect(skeleton.dns).toBeUndefined();
  });
});
