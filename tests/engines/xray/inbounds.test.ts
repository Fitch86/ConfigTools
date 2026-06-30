import { describe, it, expect } from "vitest";
import { realityModule } from "../../../src/engines/xray/inbounds/reality.js";
import { vlessWsModule } from "../../../src/engines/xray/inbounds/vless-ws.js";
import { vlessGrpcModule } from "../../../src/engines/xray/inbounds/vless-grpc.js";
import type { BuildContext } from "../../../src/engines/xray/module-api.js";

const mockCtx: BuildContext = {
  uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  realityKeyPair: {
    privateKey: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123",
    publicKey: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01",
  },
  shortIds: ["abcdef12"],
  password: "testpassword123",
  selfSignedCert: {
    certPem: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n",
    keyPem: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  },
};

describe("realityModule", () => {
  it("builds a VLESS+Reality+Vision inbound", () => {
    const result = realityModule.build(mockCtx, {
      port: 443,
      dest: "www.microsoft.com:443",
      serverNames: ["www.microsoft.com"],
      xver: 0,
    });

    expect(result.inbound.protocol).toBe("vless");
    expect(result.inbound.port).toBe(443);
    expect(result.inbound.tag).toBe("vless-reality-vision");
    expect(result.inbound.streamSettings.network).toBe("raw");
    expect(result.inbound.streamSettings.security).toBe("reality");
    expect(result.inbound.streamSettings.realitySettings).toBeDefined();
    expect(result.inbound.streamSettings.realitySettings!.dest).toBe("www.microsoft.com:443");
    expect(result.inbound.streamSettings.realitySettings!.privateKey).toBe(mockCtx.realityKeyPair!.privateKey);
    expect(result.inbound.streamSettings.realitySettings!.shortIds).toEqual(["abcdef12"]);
    expect(result.inbound.settings.clients[0].id).toBe(mockCtx.uuid);
    expect(result.inbound.settings.clients[0].flow).toBe("xtls-vision");
    expect(result.inbound.sniffing?.enabled).toBe(true);
  });

  it("sets acceptProxyProtocol when xver > 0", () => {
    const result = realityModule.build(mockCtx, {
      port: 443,
      dest: "www.microsoft.com:443",
      serverNames: ["www.microsoft.com"],
      xver: 1,
    });
    expect(result.inbound.streamSettings.rawSettings?.acceptProxyProtocol).toBe(true);
  });

  it("does not set acceptProxyProtocol when xver = 0", () => {
    const result = realityModule.build(mockCtx, {
      port: 443,
      dest: "www.microsoft.com:443",
      serverNames: ["www.microsoft.com"],
      xver: 0,
    });
    expect(result.inbound.streamSettings.rawSettings?.acceptProxyProtocol).toBeUndefined();
  });

  it("produces a client node with Reality info", () => {
    const result = realityModule.build(mockCtx, {
      port: 443,
      dest: "www.microsoft.com:443",
      serverNames: ["www.microsoft.com"],
      xver: 0,
    });
    expect(result.clientNode.protocol).toBe("vless");
    expect(result.clientNode.security).toBe("reality");
    expect(result.clientNode.extra?.publicKey).toBe(mockCtx.realityKeyPair!.publicKey);
    expect(result.clientNode.extra?.flow).toBe("xtls-vision");
  });
});

describe("vlessWsModule", () => {
  it("builds a VLESS+WS+TLS inbound", () => {
    const result = vlessWsModule.build(mockCtx, {
      port: 443,
      path: "/ws",
      host: "my.proxy.tld",
      domain: "my.proxy.tld",
    });

    expect(result.inbound.protocol).toBe("vless");
    expect(result.inbound.port).toBe(443);
    expect(result.inbound.tag).toBe("vless-ws-tls");
    expect(result.inbound.streamSettings.network).toBe("ws");
    expect(result.inbound.streamSettings.security).toBe("tls");
    expect(result.inbound.streamSettings.wsSettings?.path).toBe("/ws");
    expect(result.inbound.streamSettings.wsSettings?.host).toBe("my.proxy.tld");
    expect(result.inbound.streamSettings.tlsSettings?.serverName).toBe("my.proxy.tld");
    expect(result.inbound.streamSettings.tlsSettings?.certificates?.[0].certificateFile).toBe("certs/cert.pem");
    expect(result.inbound.settings.clients[0].id).toBe(mockCtx.uuid);
    expect(result.inbound.settings.clients[0].flow).toBeUndefined();
  });

  it("omits host in wsSettings when not provided", () => {
    const result = vlessWsModule.build(mockCtx, {
      port: 443,
      path: "/ws",
      domain: "my.proxy.tld",
    });
    expect(result.inbound.streamSettings.wsSettings?.host).toBeUndefined();
  });

  it("produces cert files when selfSignedCert exists", () => {
    const result = vlessWsModule.build(mockCtx, {
      port: 443,
      path: "/ws",
      domain: "my.proxy.tld",
    });
    expect(result.files).toHaveLength(2);
    expect(result.files![0].name).toBe("certs/cert.pem");
    expect(result.files![1].name).toBe("certs/key.pem");
  });
});

describe("vlessGrpcModule", () => {
  it("builds a VLESS+gRPC+TLS inbound", () => {
    const result = vlessGrpcModule.build(mockCtx, {
      port: 443,
      serviceName: "grpc",
      multiMode: true,
      domain: "my.proxy.tld",
    });

    expect(result.inbound.protocol).toBe("vless");
    expect(result.inbound.port).toBe(443);
    expect(result.inbound.tag).toBe("vless-grpc-tls");
    expect(result.inbound.streamSettings.network).toBe("grpc");
    expect(result.inbound.streamSettings.security).toBe("tls");
    expect(result.inbound.streamSettings.grpcSettings?.serviceName).toBe("grpc");
    expect(result.inbound.streamSettings.grpcSettings?.multiMode).toBe(true);
    expect(result.inbound.streamSettings.tlsSettings?.serverName).toBe("my.proxy.tld");
    expect(result.inbound.settings.clients[0].id).toBe(mockCtx.uuid);
  });

  it("omits multiMode when not provided", () => {
    const result = vlessGrpcModule.build(mockCtx, {
      port: 443,
      serviceName: "grpc",
      domain: "my.proxy.tld",
    });
    expect(result.inbound.streamSettings.grpcSettings?.multiMode).toBeUndefined();
  });

  it("produces cert files when selfSignedCert exists", () => {
    const result = vlessGrpcModule.build(mockCtx, {
      port: 443,
      serviceName: "grpc",
      domain: "my.proxy.tld",
    });
    expect(result.files).toHaveLength(2);
  });
});
