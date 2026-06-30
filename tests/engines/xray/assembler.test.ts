import { describe, it, expect } from "vitest";
import { assembleXrayConfig } from "../../../src/engines/xray/assembler.js";
import type { BuildContext } from "../../../src/engines/xray/module-api.js";
import { generateUuid } from "../../../src/crypto/uuid.js";
import { generateRealityKeyPair } from "../../../src/crypto/reality-keys.js";
import { generateShortIds } from "../../../src/crypto/short-id.js";
import { generatePassword } from "../../../src/crypto/password.js";
import { generateSelfSignedCert } from "../../../src/cert/self-signed.js";

function makeCtx(): BuildContext {
  return {
    uuid: generateUuid(),
    realityKeyPair: generateRealityKeyPair(),
    shortIds: generateShortIds({ count: 1, bytes: 4 }),
    password: generatePassword(),
  };
}

describe("assembleXrayConfig", () => {
  it("assembles a Reality-only config", () => {
    const ctx = makeCtx();
    const result = assembleXrayConfig({
      logLevel: "warning",
      routingPreset: "none",
      inbounds: [{
        moduleId: "reality",
        options: {
          port: 443,
          dest: "www.microsoft.com:443",
          serverNames: ["www.microsoft.com"],
          xver: 0,
        },
      }],
      ctx,
    });

    expect(result.config.inbounds).toHaveLength(1);
    expect(result.config.inbounds[0].protocol).toBe("vless");
    expect(result.config.inbounds[0].streamSettings.security).toBe("reality");
    expect(result.config.outbounds).toHaveLength(1);
    expect(result.config.log?.loglevel).toBe("Warning");
    expect(result.clientNodes).toHaveLength(1);
    expect(result.files).toHaveLength(0);
  });

  it("assembles a multi-inbound config with certs", () => {
    const ctx = makeCtx();
    ctx.selfSignedCert = generateSelfSignedCert({ domain: "my.proxy.tld" });
    const result = assembleXrayConfig({
      routingPreset: "block-ads-cn",
      inbounds: [
        { moduleId: "reality", options: { port: 443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
        { moduleId: "vless-ws", options: { port: 8443, path: "/ws", domain: "my.proxy.tld" } },
        { moduleId: "vless-grpc", options: { port: 9443, serviceName: "grpc", domain: "my.proxy.tld" } },
      ],
      ctx,
    });

    expect(result.config.inbounds).toHaveLength(3);
    expect(result.config.routing).toBeDefined();
    expect(result.config.dns).toBeDefined();
    expect(result.clientNodes).toHaveLength(3);
    // 2 cert files per TLS inbound (WS + gRPC share same cert path, dedup not needed — files list may have dupes)
    expect(result.files.length).toBeGreaterThanOrEqual(2);
  });

  it("throws for unknown module id", () => {
    expect(() => assembleXrayConfig({
      inbounds: [{ moduleId: "unknown", options: {} }],
      ctx: makeCtx(),
    })).toThrow("Unknown inbound module");
  });
});
