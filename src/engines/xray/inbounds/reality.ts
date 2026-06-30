/**
 * VLESS + Reality + Vision inbound module.
 *
 * Generates a VLESS inbound with `network: "raw"`, `security: "reality"`,
 * and `flow: "xtls-vision"`. Suitable for direct TCP connections with
 * Reality TLS camouflage.
 */

import type { XrayInbound, XrayRealitySettings, XrayRawSettings } from "../types.js";
import type { InboundModule, BuildContext, InboundResult, PromptSpec } from "../module-api.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RealityOptions {
  port: number;
  dest: string;       // e.g. "www.microsoft.com:443"
  serverNames: string[];  // e.g. ["www.microsoft.com", "microsoft.com"]
  xver: 0 | 1 | 2;
  shortIds?: string[];    // defaults from ctx.shortIds
}

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

export const realityModule: InboundModule<RealityOptions> = {
  id: "reality",
  label: "VLESS + Reality + Vision",
  optionSchema: {
    type: "object",
    required: ["port", "dest", "serverNames"],
    properties: {
      port: { type: "number", minimum: 1, maximum: 65535 },
      dest: { type: "string" },
      serverNames: { type: "array", items: { type: "string" } },
      xver: { type: "number", enum: [0, 1, 2] },
      shortIds: { type: "array", items: { type: "string" } },
    },
  },
  prompts: [
    { type: "number", name: "port", message: "Listen port", initial: 443, min: 1, max: 65535 },
    { type: "text", name: "dest", message: "Reality dest (host:port)", initial: "www.microsoft.com:443" },
    {
      type: "text",
      name: "serverNames",
      message: "Reality serverNames (comma-separated)",
      initial: "www.microsoft.com,microsoft.com",
    },
    { type: "select", name: "xver", message: "PROXY protocol version", initial: 0, choices: [
      { title: "0 (off)", value: 0 },
      { title: "1", value: 1 },
      { title: "2", value: 2 },
    ] },
  ],

  build(ctx: BuildContext, options: RealityOptions): InboundResult {
    const shortIds = options.shortIds ?? ctx.shortIds ?? [""];
    const serverNames = options.serverNames;

    const realitySettings: XrayRealitySettings = {
      dest: options.dest,
      xver: options.xver,
      serverNames,
      privateKey: ctx.realityKeyPair?.privateKey ?? "",
      shortIds,
    };

    const rawSettings: XrayRawSettings = {};
    if (options.xver > 0) {
      rawSettings.acceptProxyProtocol = true;
    }

    const inbound: XrayInbound = {
      tag: "vless-reality-vision",
      port: options.port,
      protocol: "vless",
      settings: {
        clients: [{ id: ctx.uuid, flow: "xtls-vision" }],
        decryption: "none",
      },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings,
        rawSettings,
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        routeOnly: true,
      },
    };

    return {
      inbound,
      clientNode: {
        protocol: "vless",
        port: options.port,
        network: "raw",
        security: "reality",
        remarks: "VLESS-Reality-Vision",
        extra: {
          publicKey: ctx.realityKeyPair?.publicKey ?? "",
          shortId: shortIds[0] ?? "",
          fingerprint: "chrome",
          flow: "xtls-vision",
          serverName: serverNames[0] ?? "",
        },
      },
    };
  },
};
