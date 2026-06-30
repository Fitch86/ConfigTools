/**
 * Builds the shared skeleton of an Xray 26.3 server config:
 * log, dns, routing, and outbounds.
 *
 * Routing presets are fixed in v1 (no custom rule editor).
 */

import type {
  XrayConfig,
  XrayLogLevel,
  XlogLogLevel,
  XrayRouting,
  XrayRoutingRule,
  XrayOutbound,
  XrayDns,
} from "./types.js";

// ---------------------------------------------------------------------------
// Log level mapping (user-facing lowercase → Xray wire format)
// ---------------------------------------------------------------------------

const LOG_LEVEL_MAP: Record<XrayLogLevel, XlogLogLevel> = {
  debug: "Debug",
  info: "Info",
  warning: "Warning",
  error: "Error",
  none: "None",
};

// ---------------------------------------------------------------------------
// Routing presets
// ---------------------------------------------------------------------------

export type RoutingPreset = "none" | "block-ads-cn";

// ---------------------------------------------------------------------------
// Skeleton builder input
// ---------------------------------------------------------------------------

export interface SkeletonOptions {
  logLevel?: XrayLogLevel;     // default "warning"
  routingPreset?: RoutingPreset;
}

// ---------------------------------------------------------------------------
// Build the skeleton config (everything except inbounds)
// ---------------------------------------------------------------------------

export function buildSkeleton(opts: SkeletonOptions = {}): Omit<XrayConfig, "inbounds"> {
  const logLevel = opts.logLevel ?? "warning";

  const config: Omit<XrayConfig, "inbounds"> = {
    log: buildLog(logLevel),
    outbounds: buildOutbounds(opts.routingPreset ?? "none"),
  };

  if (opts.routingPreset === "block-ads-cn") {
    config.dns = buildBlockAdsCnDns();
    config.routing = buildBlockAdsCnRouting();
  }

  return config;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

function buildLog(level: XrayLogLevel): XrayConfig["log"] {
  return { loglevel: LOG_LEVEL_MAP[level] };
}

// ---------------------------------------------------------------------------
// Outbounds
// ---------------------------------------------------------------------------

function buildOutbounds(preset: RoutingPreset): XrayOutbound[] {
  const direct: XrayOutbound = {
    tag: "direct",
    protocol: "freedom",
  };

  if (preset === "none") {
    return [direct];
  }

  // block-ads-cn preset
  return [
    direct,
    { tag: "block", protocol: "blackhole" },
    { tag: "dns", protocol: "dns" },
  ];
}

// ---------------------------------------------------------------------------
// DNS for block-ads-cn preset
// ---------------------------------------------------------------------------

function buildBlockAdsCnDns(): XrayDns {
  return {
    servers: [
      {
        address: "localhost",
        domains: ["domain:geosite:cn"],
        skipFallback: true,
      },
      {
        address: "1.1.1.1",
        port: 53,
        skipFallback: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Routing for block-ads-cn preset
// ---------------------------------------------------------------------------

function buildBlockAdsCnRouting(): XrayRouting {
  const rules: XrayRoutingRule[] = [
    // Block ads
    {
      type: "field",
      outboundTag: "block",
      domain: ["geosite:category-ads-all"],
    },
    // Block private/LAN
    {
      type: "field",
      outboundTag: "block",
      ip: ["geoip:private"],
    },
    // Direct CN ips
    {
      type: "field",
      outboundTag: "direct",
      ip: ["geoip:cn"],
    },
    // Direct CN domains
    {
      type: "field",
      outboundTag: "direct",
      domain: ["geosite:cn"],
    },
  ];

  return {
    domainStrategy: "IPIfNonMatch",
    rules,
  };
}
