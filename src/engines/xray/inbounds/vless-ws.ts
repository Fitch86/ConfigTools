/**
 * VLESS + WebSocket + TLS inbound module.
 *
 * Generates a VLESS inbound with `network: "ws"`, `security: "tls"`.
 * Uses the self-signed cert from the build context for TLS termination.
 */

import type { XrayInbound, XrayWsSettings, XrayTlsSettings } from "../types.js";
import type { InboundModule, BuildContext, InboundResult, PromptSpec } from "../module-api.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VlessWsOptions {
  port: number;
  path: string;     // e.g. "/ws"
  host?: string;    // WS host header (usually the domain)
  domain: string;  // for TLS serverName + cert SAN
}

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

export const vlessWsModule: InboundModule<VlessWsOptions> = {
  id: "vless-ws",
  label: "VLESS + WS + TLS",
  optionSchema: {
    type: "object",
    required: ["port", "path", "domain"],
    properties: {
      port: { type: "number", minimum: 1, maximum: 65535 },
      path: { type: "string" },
      host: { type: "string" },
      domain: { type: "string" },
    },
  },
  prompts: [
    { type: "number", name: "port", message: "Listen port", initial: 443, min: 1, max: 65535 },
    { type: "text", name: "path", message: "WebSocket path", initial: "/ws" },
    { type: "text", name: "domain", message: "Domain (for TLS + cert SAN)", initial: "" },
    { type: "text", name: "host", message: "WS host header (leave empty to use domain)", initial: "" },
  ],

  build(ctx: BuildContext, options: VlessWsOptions): InboundResult {
    // Defensive defaults for fields that may be missing from UI
    const port = options.port ?? 443;
    const path = options.path ?? "/ws";
    const domain = options.domain ?? "example.com";

    const wsSettings: XrayWsSettings = {
      path,
      ...(options.host ? { host: options.host } : {}),
    };

    const tlsSettings: XrayTlsSettings = {
      serverName: domain,
      certificates: [
        {
          certificateFile: "certs/cert.pem",
          keyFile: "certs/key.pem",
        },
      ],
    };

    const inbound: XrayInbound = {
      tag: "vless-ws-tls",
      port,
      protocol: "vless",
      settings: {
        clients: [{ id: ctx.uuid }],
        decryption: "none",
      },
      streamSettings: {
        network: "ws",
        security: "tls",
        wsSettings,
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
        port,
        network: "ws",
        security: "tls",
        remarks: "VLESS-WS-TLS",
        extra: {
          path,
          host: options.host || domain,
          sni: domain,
          fingerprint: "chrome",
        },
      },
    };
  },
};
