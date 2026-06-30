/**
 * TypeScript interfaces for Xray-core 26.3 server-side config.json.
 *
 * Field names and structures are verified against Xray-core source
 * (transport_internet.go, config.go on main branch).
 */

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

export interface XrayConfig {
  log?: XrayLog;
  dns?: XrayDns;
  routing?: XrayRouting;
  inbounds: XrayInbound[];
  outbounds: XrayOutbound[];
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export type XrayLogLevel = "debug" | "info" | "warning" | "error" | "none";

export interface XrayLog {
  loglevel?: XlogLogLevel;
  access?: string;
  error?: string;
}

/** Wire key name used in Xray JSON */
export type XlogLogLevel = "Debug" | "Info" | "Warning" | "Error" | "None";

// ---------------------------------------------------------------------------
// DNS
// ---------------------------------------------------------------------------

export interface XrayDns {
  servers: XrayDnsServer[];
  tags?: Record<string, string>;
}

export interface XrayDnsServer {
  address: string;
  port?: number;
  domains?: string[];
  skipFallback?: boolean;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type XrayRoutingDomainStrategy =
  | "AsIs"
  | "IPIfNonMatch"
  | "IPOnDemand";

export interface XrayRouting {
  domainStrategy?: XrayRoutingDomainStrategy;
  domainMatcher?: "hybrid" | "linear";
  rules: XrayRoutingRule[];
}

export interface XrayRoutingRule {
  type: "field";
  outboundTag?: string;
  inboundTag?: string[];
  domain?: (string | { type: string; value: string })[];
  ip?: (string | { type: string; value: string })[];
  port?: string | number;
  sourcePort?: string | number;
  network?: "tcp" | "udp" | "tcp,udp";
  source?: string[];
  user?: string[];
}

// ---------------------------------------------------------------------------
// Inbounds
// ---------------------------------------------------------------------------

export type XrayNetworkName = "raw" | "ws" | "grpc" | "h2" | "http";
export type XraySecurityName = "none" | "tls" | "reality";
export type XrayTransportName = "raw" | "ws" | "grpc";

export interface XrayInbound {
  tag: string;
  port: number;
  listen?: string;
  protocol: "vless";
  settings: XrayInboundSettings;
  streamSettings: XrayStreamSettings;
  sniffing?: XraySniffing;
}

// ---------------------------------------------------------------------------
// Inbound settings (VLESS)
// ---------------------------------------------------------------------------

export interface XrayInboundSettings {
  clients: XrayVlessClient[];
  decryption: "none";
}

export interface XrayVlessClient {
  id: string;           // UUID
  flow?: string;         // "xtls-vision" for Reality+Vision
}

// ---------------------------------------------------------------------------
// Sniffing
// ---------------------------------------------------------------------------

export interface XraySniffing {
  enabled: boolean;
  destOverride: string[];
  routeOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Stream settings
// ---------------------------------------------------------------------------

export interface XrayStreamSettings {
  network: XrayNetworkName;
  security: XraySecurityName;
  tlsSettings?: XrayTlsSettings;
  realitySettings?: XrayRealitySettings;
  wsSettings?: XrayWsSettings;
  grpcSettings?: XrayGrpcSettings;
  rawSettings?: XrayRawSettings;
}

// ---------------------------------------------------------------------------
// RAW (TCP) transport
// ---------------------------------------------------------------------------

export interface XrayRawSettings {
  acceptProxyProtocol?: boolean;
}

// ---------------------------------------------------------------------------
// WebSocket transport
// ---------------------------------------------------------------------------

export interface XrayWsSettings {
  path: string;
  host?: string;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// gRPC transport
// ---------------------------------------------------------------------------

export interface XrayGrpcSettings {
  serviceName: string;
  multiMode?: boolean;
  idleTimeout?: number;
  initialWindowsSize?: number;
  userAgent?: string;
  healthCheckTimeout?: number;
}

// ---------------------------------------------------------------------------
// TLS settings
// ---------------------------------------------------------------------------

export interface XrayTlsSettings {
  serverName?: string;
  alpn?: string[];
  minVersion?: string;
  cipherSuites?: string[];
  fingerprint?: string;
  certificates?: XrayTlsCertificate[];
  allowInsecure?: boolean;
}

export interface XrayTlsCertificate {
  certificateFile: string;
  keyFile: string;
}

// ---------------------------------------------------------------------------
// Reality settings
// ---------------------------------------------------------------------------

export interface XrayRealitySettings {
  show?: boolean;
  dest: string;                           // "host:port" or just port
  xver: 0 | 1 | 2;
  serverNames: string[];
  privateKey: string;                     // base64url 32 bytes
  shortIds: string[];                     // hex, even length, ≤16 chars
}

// ---------------------------------------------------------------------------
// Outbounds
// ---------------------------------------------------------------------------

export type XrayOutboundProtocol =
  | "freedom"
  | "blackhole"
  | "dns";

export interface XrayOutbound {
  tag: string;
  protocol: XrayOutboundProtocol;
  settings?: Record<string, unknown>;
  streamSettings?: Record<string, unknown>;
}
