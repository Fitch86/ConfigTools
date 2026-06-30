import { describe, it, expect } from "vitest";
import { assembleXrayConfig } from "../../src/engines/xray/assembler.js";
import { validateXrayConfig } from "../../src/validate/index.js";
import { formatJson, formatJsonString } from "../../src/format/json.js";
import { generateUuid } from "../../src/crypto/uuid.js";
import { generateRealityKeyPair } from "../../src/crypto/reality-keys.js";
import { generateShortIds } from "../../src/crypto/short-id.js";
import { generatePassword } from "../../src/crypto/password.js";
import { generateSelfSignedCert } from "../../src/cert/self-signed.js";
import type { BuildContext } from "../../src/engines/xray/module-api.js";

/**
 * End-to-end test: builds a complete multi-inbound Xray config
 * (Reality + WS + gRPC), validates, formats, and re-validates.
 * This exercises the full pipeline from crypto generation through config
 * assembly and validation, without touching the filesystem or terminal.
 */

describe("E2E: full config generation pipeline", () => {
  it("builds, validates, formats, and re-validates a Reality-only config", () => {
    const ctx: BuildContext = {
      uuid: generateUuid(),
      realityKeyPair: generateRealityKeyPair(),
      shortIds: generateShortIds({ count: 2, bytes: 4 }),
      password: generatePassword(),
    };

    // Assemble
    const result = assembleXrayConfig({
      logLevel: "warning",
      routingPreset: "block-ads-cn",
      inbounds: [
        { moduleId: "reality", options: { port: 10443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com", "microsoft.com"], xver: 0 } },
      ],
      ctx,
    });

    // Validate
    const v1 = validateXrayConfig(result.config);
    expect(v1.valid).toBe(true);

    // Format
    const json = formatJson(result.config);
    const parsed = JSON.parse(json);
    expect(parsed.inbounds).toHaveLength(1);
    expect(parsed.inbounds[0].protocol).toBe("vless");
    expect(parsed.inbounds[0].streamSettings.security).toBe("reality");

    // Re-validate the formatted (round-tripped) config
    const v2 = validateXrayConfig(parsed);
    expect(v2.valid).toBe(true);

    // Idempotency check
    const reformatted = formatJsonString(json);
    expect(reformatted).toBe(json);
  });

  it("builds, validates, and formats a multi-inbound config with certs", () => {
    const domain = "test.proxy.tld";
    const cert = generateSelfSignedCert({ domain });
    const ctx: BuildContext = {
      uuid: generateUuid(),
      realityKeyPair: generateRealityKeyPair(),
      shortIds: generateShortIds({ count: 1, bytes: 4, includeEmpty: true }),
      password: generatePassword(),
      selfSignedCert: cert,
    };

    // Assemble with all three inbound types
    const result = assembleXrayConfig({
      routingPreset: "block-ads-cn",
      inbounds: [
        { moduleId: "reality", options: { port: 10443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
        { moduleId: "vless-ws", options: { port: 20443, path: "/ws-path", domain } },
        { moduleId: "vless-grpc", options: { port: 30443, serviceName: "GunTLS", multiMode: true, domain } },
      ],
      ctx,
    });

    // Validate
    const v = validateXrayConfig(result.config);
    expect(v.valid).toBe(true);
    expect(v.issues).toHaveLength(0);

    // Structure checks
    expect(result.config.inbounds).toHaveLength(3);
    expect(result.config.routing).toBeDefined();
    expect(result.config.dns).toBeDefined();
    expect(result.clientNodes).toHaveLength(3);

    // Each inbound has the right security type
    expect(result.config.inbounds[0].streamSettings.security).toBe("reality");
    expect(result.config.inbounds[1].streamSettings.security).toBe("tls");
    expect(result.config.inbounds[2].streamSettings.security).toBe("tls");

    // Cert files are produced
    expect(result.files.length).toBeGreaterThanOrEqual(2);

    // All client UUIDs are the same
    const uuids = result.config.inbounds.map(ib => ib.settings.clients[0].id);
    expect(new Set(uuids).size).toBe(1);

    // Ports are unique
    const ports = result.config.inbounds.map(ib => ib.port);
    expect(new Set(ports).size).toBe(ports.length);

    // Re-validate the round-tripped config
    const json = formatJson(result.config);
    const parsed = JSON.parse(json);
    const v2 = validateXrayConfig(parsed);
    expect(v2.valid).toBe(true);
  });

  it("generates a none-routing config with a single WS inbound", () => {
    const domain = "ws-only.tld";
    const cert = generateSelfSignedCert({ domain });
    const ctx: BuildContext = {
      uuid: generateUuid(),
      password: generatePassword(),
      selfSignedCert: cert,
    };

    const result = assembleXrayConfig({
      routingPreset: "none",
      inbounds: [
        { moduleId: "vless-ws", options: { port: 10443, path: "/ws", domain } },
      ],
      ctx,
    });

    const v = validateXrayConfig(result.config);
    expect(v.valid).toBe(true);
    expect(result.config.routing).toBeUndefined();
    expect(result.config.dns).toBeUndefined();
    expect(result.config.inbounds).toHaveLength(1);
    expect(result.config.inbounds[0].streamSettings.wsSettings?.path).toBe("/ws");
  });

  it("share link generation works for Reality client node", () => {
    const ctx: BuildContext = {
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      realityKeyPair: generateRealityKeyPair(),
      shortIds: ["abcdef12"],
      password: generatePassword(),
    };

    const result = assembleXrayConfig({
      inbounds: [
        { moduleId: "reality", options: { port: 10443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
      ],
      ctx,
    });

    const node = result.clientNodes[0];
    expect(node.protocol).toBe("vless");
    expect(node.security).toBe("reality");
    expect(node.extra?.publicKey).toBeTruthy();
    expect(node.extra?.flow).toBe("xtls-vision");
    expect(node.extra?.shortId).toBe("abcdef12");
  });
});
