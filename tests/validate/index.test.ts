import { describe, it, expect } from "vitest";
import { validateXrayConfig } from "../../src/validate/index.js";
import type { XrayConfig } from "../../src/engines/xray/types.js";
import { assembleXrayConfig } from "../../src/engines/xray/assembler.js";
import { generateUuid } from "../../src/crypto/uuid.js";
import { generateRealityKeyPair } from "../../src/crypto/reality-keys.js";
import { generateShortIds } from "../../src/crypto/short-id.js";
import { generatePassword } from "../../src/crypto/password.js";
import { generateSelfSignedCert } from "../../src/cert/self-signed.js";
import type { BuildContext } from "../../src/engines/xray/module-api.js";

/** Build a valid config to use as test base */
function makeValidConfig(): XrayConfig {
  const ctx: BuildContext = {
    uuid: generateUuid(),
    realityKeyPair: generateRealityKeyPair(),
    shortIds: generateShortIds({ count: 1, bytes: 4 }),
    password: generatePassword(),
  };
  const result = assembleXrayConfig({
    routingPreset: "block-ads-cn",
    inbounds: [
      { moduleId: "reality", options: { port: 10443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
    ],
    ctx,
  });
  return result.config;
}

describe("validateXrayConfig", () => {
  it("accepts a valid assembled config", () => {
    const config = makeValidConfig();
    const result = validateXrayConfig(config);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects missing inbounds", () => {
    const result = validateXrayConfig({ outbounds: [{ tag: "direct", protocol: "freedom" }] });
    expect(result.valid).toBe(false);
    // ajv reports paths like /inbounds or /required
    expect(result.issues.some(i => i.path.includes("inbound") || i.message.includes("inbounds"))).toBe(true);
  });

  it("catches invalid port (0)", () => {
    const config = makeValidConfig();
    config.inbounds[0].port = 0;
    const result = validateXrayConfig(config);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.path.includes("port"))).toBe(true);
  });

  it("catches invalid port (70000)", () => {
    const config = makeValidConfig();
    config.inbounds[0].port = 70000;
    const result = validateXrayConfig(config);
    expect(result.valid).toBe(false);
  });

  it("warns on privileged port (<1024)", () => {
    const config = makeValidConfig();
    config.inbounds[0].port = 443;
    const result = validateXrayConfig(config);
    const warnings = result.issues.filter(i => i.level === "warning");
    expect(warnings.some(i => i.path.includes("port"))).toBe(true);
  });

  it("catches duplicate ports", () => {
    const ctx: BuildContext = {
      uuid: generateUuid(),
      realityKeyPair: generateRealityKeyPair(),
      shortIds: generateShortIds({ count: 1, bytes: 4 }),
      password: generatePassword(),
      selfSignedCert: generateSelfSignedCert({ domain: "test.local" }),
    };
    const result = assembleXrayConfig({
      inbounds: [
        { moduleId: "reality", options: { port: 10443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
        { moduleId: "vless-ws", options: { port: 10443, path: "/ws", domain: "test.local" } },
      ],
      ctx,
    });
    const validation = validateXrayConfig(result.config);
    expect(validation.issues.some(i => i.message.includes("also used by"))).toBe(true);
  });

  it("catches invalid UUID format", () => {
    const config = makeValidConfig();
    config.inbounds[0].settings.clients[0].id = "not-a-uuid";
    const result = validateXrayConfig(config);
    // ajv uses /inbounds/0/... path format or business rule uses inbounds[0]...
    expect(result.issues.some(i => 
      (i.path.includes("clients") || i.path.includes("inbounds")) && 
      i.message.toLowerCase().includes("uuid")
    )).toBe(true);
  });

  it("catches invalid Reality privateKey (wrong length)", () => {
    const config = makeValidConfig();
    const rs = config.inbounds[0].streamSettings.realitySettings!;
    rs.privateKey = "tooshort";
    const result = validateXrayConfig(config);
    expect(result.issues.some(i => i.path.includes("privateKey"))).toBe(true);
  });

  it("catches missing Reality dest", () => {
    const config = makeValidConfig();
    const rs = config.inbounds[0].streamSettings.realitySettings!;
    rs.dest = "";
    const result = validateXrayConfig(config);
    expect(result.issues.some(i => i.path.includes("dest"))).toBe(true);
  });
});
