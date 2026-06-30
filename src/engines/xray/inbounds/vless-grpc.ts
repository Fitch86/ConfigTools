/**
 * VLESS + gRPC + TLS inbound module.
 *
 * Generates a VLESS inbound with `network: "grpc"`, `security: "tls"`.
 * Uses the self-signed cert from the build context for TLS termination.
 */

import type { XrayInbound, XrayGrpcSettings, XrayTlsSettings } from "../types.js";
import type { InboundModule, BuildContext, InboundResult, PromptSpec } from "../module-api.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VlessGrpcOptions {
  port: number;
  serviceName: string;   // e.g. "grpc"
  multiMode?: boolean;
  domain: string;        // for TLS serverName + cert SAN
}

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

export const vlessGrpcModule: InboundModule<VlessGrpcOptions> = {
  id: "vless-grpc",
  label: "VLESS + gRPC + TLS",
  optionSchema: {
    type: "object",
    required: ["port", "serviceName", "domain"],
    properties: {
      port: { type: "number", minimum: 1, maximum: 65535 },
      serviceName: { type: "string" },
      multiMode: { type: "boolean" },
      domain: { type: "string" },
    },
  },
  prompts: [
    { type: "number", name: "port", message: "Listen port", initial: 443, min: 1, max: 65535 },
    { type: "text", name: "serviceName", message: "gRPC service name", initial: "grpc" },
    {
      type: "confirm",
      name: "multiMode",
      message: "Enable multiMode?",
      initial: true,
    },
    { type: "text", name: "domain", message: "Domain (for TLS + cert SAN)", initial: "" },
  ],

  build(ctx: BuildContext, options: VlessGrpcOptions): InboundResult {
    const grpcSettings: XrayGrpcSettings = {
      serviceName: options.serviceName,
      ...(options.multiMode != null ? { multiMode: options.multiMode } : {}),
    };

    const tlsSettings: XrayTlsSettings = {
      serverName: options.domain,
      certificates: [
        {
          certificateFile: "certs/cert.pem",
          keyFile: "certs/key.pem",
        },
      ],
    };

    const inbound: XrayInbound = {
      tag: "vless-grpc-tls",
      port: options.port,
      protocol: "vless",
      settings: {
        clients: [{ id: ctx.uuid }],
        decryption: "none",
      },
      streamSettings: {
        network: "grpc",
        security: "tls",
        grpcSettings,
        tlsSettings,
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        routeOnly: true,
      },
    };

    const files: InboundResult["files"] = [];
    if (ctx.selfSignedCert) {
      files.push(
        { name: "certs/cert.pem", content: ctx.selfSignedCert.certPem },
        { name: "certs/key.pem", content: ctx.selfSignedCert.keyPem },
      );
    }

    return {
      inbound,
      files,
      clientNode: {
        protocol: "vless",
        port: options.port,
        network: "grpc",
        security: "tls",
        remarks: "VLESS-gRPC-TLS",
        extra: {
          serviceName: options.serviceName,
          mode: options.multiMode ? "multi" : "gun",
          sni: options.domain,
          fingerprint: "chrome",
        },
      },
    };
  },
};
