# configtools

**Interactive Xray-core 26.3 server-side config generator.**

Generates a valid `config.json` for Xray-core 26.3, auto-generates credentials (UUID, Reality keypair, shortIds) and self-signed certificates, and supports a **manual-edit → format → check** loop on generated files.

## Install & Run

```bash
# Run directly via npx (no install needed)
npx configtools new my-server

# Or install globally
npm install -g configtools
configtools new my-server
```

## Features

- **Three inbound protocols**: VLESS+Reality+Vision, VLESS+WS+TLS, VLESS+gRPC+TLS
- **Auto-generated credentials**: UUID, X25519 Reality keypair, shortIds, ECDSA P-256 self-signed cert
- **Routing presets**: `none` (all direct) or `block-ads-cn` (block ads + CN direct)
- **Validation**: JSON Schema + business rules (port ranges, UUID format, Reality key length, duplicate ports, etc.)
- **Stable formatter**: sorted keys, idempotent (`format ∘ format === format`)
- **Project model**: reloadable project dirs for edit → rebuild workflow

## CLI Commands

```
configtools new [name]              Create a new project interactively
configtools edit <name>            Reload & re-prompt, rebuild
configtools check <name> [file]    Validate server.json
configtools format <name>          Reformat server.json in place
configtools list                    Show projects in output/
configtools --help                 Show help
configtools --version              Show version
```

## Quick Start

```bash
# Create a new Xray config with Reality + WS + gRPC
configtools new my-server

# The tool will interactively ask:
# 1. Which inbound protocols? (Reality, WS, gRPC)
# 2. Common options (log level, routing preset)
# 3. Per-inbound options (port, domain, etc.)
# Then auto-generates all credentials and writes the config.

# After manual edits, validate and reformat:
configtools check my-server
configtools format my-server

# To regenerate from scratch with different options:
configtools edit my-server
```

## Output Structure

```
output/my-server/
├── server.json     # The Xray config (hand-editable)
├── project.json    # Source of truth (input choices for rebuild)
├── README.md       # Summary + share links + credentials
└── certs/          # cert.pem + key.pem (if WS/gRPC present)
```

## Programmatic Usage

```ts
import {
  assembleXrayConfig,
  validateXrayConfig,
  formatJson,
  generateUuid,
  generateRealityKeyPair,
  generateShortIds,
  generateSelfSignedCert,
} from "configtools";

const ctx = {
  uuid: generateUuid(),
  realityKeyPair: generateRealityKeyPair(),
  shortIds: generateShortIds({ count: 1, bytes: 4 }),
  password: generatePassword(),
  selfSignedCert: generateSelfSignedCert({ domain: "my.proxy.tld" }),
};

const result = assembleXrayConfig({
  routingPreset: "block-ads-cn",
  inbounds: [
    { moduleId: "reality", options: { port: 443, dest: "www.microsoft.com:443", serverNames: ["www.microsoft.com"], xver: 0 } },
    { moduleId: "vless-ws", options: { port: 8443, path: "/ws", domain: "my.proxy.tld" } },
  ],
  ctx,
});

const validation = validateXrayConfig(result.config);
if (validation.valid) {
  console.log(formatJson(result.config));
}
```

## Supported Inbound Protocols

| Module | Network | Security | Notes |
|--------|---------|----------|-------|
| VLESS+Reality+Vision | raw | reality | Direct TCP with Reality TLS camouflage |
| VLESS+WS+TLS | ws | tls | WebSocket over TLS, CDN-friendly |
| VLESS+gRPC+TLS | grpc | tls | gRPC over TLS, supports multiMode |

## Validation Rules

Beyond JSON Schema structural checks, the validator enforces:

- Port range (1–65535), warns on privileged ports
- UUID format (RFC4122 v4)
- Reality dest format (`host:port`)
- Reality serverNames non-empty
- Reality privateKey decodes to 32 bytes (base64url)
- ShortIds are hex, even length, ≤16 chars
- No duplicate inbound ports
- Routing rule tag references exist in outbounds/inbounds

## Requirements

- Node.js 18+ (uses `crypto.randomUUID`, native X25519)

## License

MIT
