# ConfigTools — Xray-core Config Generator (v1) Design

**Date:** 2026-06-24
**Status:** Draft, pending user review
**Scope:** v1 — Xray-core 26.3 server-side config generation only

---

## 1. Goal

An interactive CLI tool that generates a valid **Xray-core 26.3** server-side `config.json`,
auto-generates credentials (UUID, Reality keypair, shortIds) and self-signed certificates,
and supports a **manual-edit → format → check** loop on the generated files.

Distributed via npm: `npx configtools ...`. Written in TypeScript, runs on Node 18+.

### Non-goals for v1 (deferred to later iterations)

- sing-box config generation (v2)
- Clash Verge client config generation (v2)
- Cloudflare Argo tunnel nodes (v2)
- Custom routing rule editor (v1 ships fixed presets)
- VMess / Shadowsocks / Trojan protocols (v1 is VLESS-only)

These are intentionally out of scope so the generation/check/format pipeline can be built
and validated end-to-end first. The architecture is designed so each is an additive module.

---

## 2. Key Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Interaction | Interactive CLI (prompts-style, like fscarmen scripts) |
| v1 protocol engine | Xray-core only |
| v1 inbound protocols | VLESS + Reality + Vision; VLESS + WS + TLS; VLESS + gRPC + TLS |
| Credential generation | Built-in, zero deps: UUID, X25519 Reality keypair, shortIds |
| Self-signed cert | Generated for WS/gRPC (Reality needs none); **ECDSA P-256** default |
| Argo | Deferred to v2 |
| Validation | JSON Schema (ajv) + business rules — no external binary dependency |
| Language / distribution | TypeScript, compiled to JS, published to npm, runnable via `npx` |
| Project model | Reloadable project dir (`output/<name>/`) — `project.json` is source of truth |
| UUID sharing | One UUID per project, shared across all inbounds |
| Routing | Fixed presets: `none`, `block-ads-cn` |
| Architecture | Template registry + pure builder functions (Approach A) |
| Testing | Unit tests of pure functions (Vitest) |
| Runtime deps | Minimal: `prompts`, `ajv`, `ajv-formats`, `kleur` |

---

## 3. Architecture & Module Layout

Generation engine built around a **registry of protocol modules**. Each module is
self-contained and produces a piece of an Xray config from pure data. The CLI is a thin
frontend that asks questions, feeds answers to the engine, and writes the result.

```
src/
├── engines/
│   └── xray/                      # v1 engine. engines/sing-box, engines/clash added later.
│       ├── index.ts               # public API: generateXrayConfig(input) → Config
│       ├── types.ts               # Xray config TS interfaces (Inbound, StreamSettings, RealitySettings…)
│       ├── schema.ts              # JSON Schema for the whole Xray config (for validation)
│       ├── skeleton.ts            # buildLog/Dns/Routing/Outbounds base (shared by all protocols)
│       ├── registry.ts            # maps inbound-type → { optionSchema, prompts, build() }
│       └── inbounds/
│           ├── reality.ts         # VLESS + Reality + Vision module
│           ├── vless-ws.ts        # VLESS + WS + TLS module
│           └── vless-grpc.ts      # VLESS + gRPC + TLS module
├── crypto/                        # built-in credential generation (no external deps)
│   ├── uuid.ts                    # RFC4122 v4 UUID (crypto.randomUUID)
│   ├── reality-keys.ts            # X25519 keypair (base64url, matches `xray x25519`)
│   ├── short-id.ts                # random hex shortIds (0–16 chars, even length)
│   └── password.ts                # base64url random password (forward-compat for v2)
├── cert/
│   └── self-signed.ts             # self-signed X.509 cert+key (Node crypto, PEM, ECDSA P-256)
├── validate/
│   ├── index.ts                   # validateXray(config) → ValidationIssue[]
│   └── rules.ts                   # business rules
├── format/
│   └── json.ts                    # pretty-print + stable key sort, idempotent
├── project/
│   └── store.ts                   # load/save a project dir: project.json + server.json + creds + certs
├── cli/
│   ├── index.ts                   # entry: parses subcommands (new / edit / check / format / list)
│   ├── prompts.ts                 # interactive prompts derived from each module's optionSchema
│   └── output.ts                  # writes files, prints share links + summary table
└── index.ts                       # library entrypoint (for programmatic use)
```

**Key property:** every module under `engines/xray/inbounds/` exports the same shape —
`{ id, label, optionSchema, prompts, build(ctx, options) }` — and `registry.ts` lists them.
Adding sing-box later means adding `engines/sing-box/` with the same internal structure; the
CLI and project layer do not change. Generation functions are pure (`input → config`), so they
are unit-testable without touching the filesystem or terminal.

### Xray 26.x field-name facts (verified from Xray-core `transport_internet.go` on `main`)

These drive the TS interfaces and the JSON Schema — captured here so the spec is unambiguous:

- **Network names**: the user-facing JSON accepts `"raw"` (canonical, was `"tcp"`), `"ws"`/`"websocket"`,
  `"grpc"`, `"h2"`/`"h3"`/`"http"`. Source normalizes `raw`/`tcp`→tcp, `ws`/`websocket`→websocket.
  The generator emits `"raw"`/`"ws"`/`"grpc"` and documents the aliases.
- **REALITY settings** object fields: `show`, `target` (alias of `dest`), `dest`, `type`, `xver`,
  `serverNames[]`, `privateKey`, `shortIds[]`, `fingerprint`, `serverName`, `publicKey`, `shortId`,
  `spiderX`, plus new 26.x optional fields (`minClientVer`, `maxTimeDiff`, `masterKeyLog`, `mldsa65*`,
  `limitFallback*`). v1 emits the stable subset: `dest`, `serverNames`, `privateKey`, `shortIds`,
  `xver`, and optionally `show`.
  - `dest`: string `"host:port"`; an integer is treated as `localhost:<port>`.
  - `xver`: must be 0, 1, or 2 (PROXY protocol version). v1 default: `0`.
  - `privateKey`: **base64url (no padding)** of 32 bytes — X25519. Decode must succeed and yield
    exactly 32 bytes or Xray rejects it.
- **WS settings**: `path`, `host` (top-level field in current versions; `headers.host` deprecated),
  `headers` (arbitrary key/value, must not contain `host`).
- **gRPC settings**: `serviceName`, `multiMode`, `idleTimeout`, `initialWindowsSize`, `userAgent`,
  `healthCheckTimeout`, plus 26.x `noGRPCHeader`, `noSSEHeader`.
- **TLS settings**: `serverName`, `alpn[]`, `minVersion`, `cipherSuites`, `fingerprint`, `certificates[]`,
  and 26.x `allowInsecure`. `certificates[]` entries: `{ certificateFile, keyFile }` or
  `{ certificate, key }` (inline PEM).

---

## 4. Module Interface & Data Flow

### 4.1 The shared module shape (`engines/xray/types.ts`)

```ts
interface InboundModule<TOptions> {
  id: 'reality' | 'vless-ws' | 'vless-grpc';   // registry key
  label: string;                                 // shown in prompts
  optionSchema: JSONSchema;                      // describes + validates TOptions
  prompts: PromptSpec[];                         // how to ask for each option
  build(ctx: BuildContext, options: TOptions): InboundResult;
}

interface InboundResult {
  inbound: XrayInbound;          // one entry for config.inbounds[]
  secrets: SecretArtifact[];     // files to write alongside config (cert, key)
  clientNodes: ClientNode[];     // share links / client info (v1 printed in README)
}

interface BuildContext {
  uuid: string;                                  // shared client UUID
  realityKeyPair?: { privateKey: string; publicKey: string };  // only if Reality present
  shortIds?: string[];                          // only for Reality
  selfSignedCert?: { certPem: string; keyPem: string };        // only if WS/gRPC present
  password?: string;                            // forward-compat, generated always
}
```

A module never generates secrets itself — it consumes what `BuildContext` provides. Secret
generation is centralized and testable, and lets `--regenerate-uuid` swap one value and rebuild all.

### 4.2 End-to-end data flow

```
User runs `configtools new`
   │
   ▼
[1] Prompts: engine → "xray"
       inbound types (multi) → e.g. [reality, vless-ws]
       common options:
         - public address  (the server's public IP or domain — goes into client nodes / share links)
         - log level, routing preset
       per-inbound options (each chosen inbound's module.prompts):
         - listen port (unique per inbound), listen address (default empty = all interfaces)
         - domain  ← ONLY asked when a WS/gRPC inbound is present (needed for cert SAN + TLS SNI)
       note: Reality-only configs never ask for a domain.
   ▼
[2] Build context: crypto/* generates UUID, (Reality keys, shortIds), (self-signed cert if needed)
   ▼
[3] Engine assembles:
       skeleton (log/dns/routing/outbounds) + each module.build(ctx, opts).inbound
       → one complete XrayConfig object
   ▼
[4] validateXray(config) → ValidationIssue[]
       on errors: print them, do NOT write, offer to re-prompt the offending option
   ▼
[5] Write project dir  output/<name>/
       server.json     — the generated config (pretty-printed + key-sorted)
       project.json    — full input: engine + chosen inbounds + their options + ctx
       README.md       — summary table: nodes, ports, share links, fingerprint advice
       certs/          — cert.pem + key.pem (only if WS/gRPC)
   ▼ done. Hand-edit server.json then run `check <name>` / `format <name>` / `edit <name>`.
```

### 4.3 Why `project.json` is the source of truth

Stores the **input choices**, not the generated output. So:

- `configtools edit <name>` reloads `project.json`, re-runs prompts with current values as defaults,
  lets the user change one field, then rebuilds from scratch. No partial patching.
- `configtools check <name>` validates the **hand-edited** `server.json` (the file the user may have touched).
- `configtools format <name>` reformats `server.json` in place.

Hand-editing the output and regenerating never conflict: `server.json` is always rebuildable from
`project.json`, and `check` operates on whatever's currently on disk.

### 4.4 CLI surface

```
configtools new [name]                              # interactive: choose engine + inbounds → generate
configtools edit <name>                             # reload project.json, re-prompt with current defaults
configtools check <name> [--file server.json]       # validate a project's config (or any file)
configtools format <name> [--file server.json]      # pretty-print in place
configtools list                                    # show projects in output/
```

`new` is the primary path; the others are the manual-change + format + check workflow.

---

## 5. Credential & Certificate Generation (zero external deps)

All in `src/crypto/` and `src/cert/`, using only Node 22's built-in `crypto` module.
No `uuid`, `node-forge`, or similar runtime dependencies.

### 5.1 UUID (`crypto/uuid.ts`)

```ts
export function generateUuid(): string {
  return crypto.randomUUID();   // RFC4122 v4
}
```
Format-validated everywhere by a regex rule in `validate/rules.ts`.

### 5.2 Reality keypair (`crypto/reality-keys.ts`)

Must match `xray x25519` output exactly: `privateKey` and `publicKey` are the **base64url**
(no padding) of the raw 32-byte X25519 key. Node 22 has native `crypto.generateKeyPairSync('x25519', ...)`.
The PKCS8 DER private-key encoding for X25519 is a fixed 48-byte blob (`30 2e 02 01 00 30 05 06 03 2b 65 6e 04 22 04 20`
+ 32 raw bytes), so the raw 32 bytes are at offset 16. The SPKI DER public-key encoding is a fixed 44-byte
blob (`30 2a 30 05 06 03 2b 65 6e 03 21 00` + 32 raw bytes), so the raw 32 bytes are at offset 12. Base64url-encode
those extracted 32-byte slices.

```ts
export function generateRealityKeyPair(): { privateKey: string; publicKey: string }
```

A unit test asserts the derived public key matches `crypto.diffieHellman` / manual X25519, and that
output decodes to exactly 32 bytes via `base64.RawURLEncoding` (mirroring Xray's own check).

### 5.3 Reality shortIds (`crypto/short-id.ts`)

Each shortId is hex, even length, ≤16 chars. Empty string `""` is allowed (means "match any").
Default: generate one 8-char hex id.

### 5.4 Self-signed certificate (`cert/self-signed.ts`)

Only generated when WS+TLS or gRPC+TLS inbounds are present. **ECDSA P-256** default.

```ts
export function generateSelfSignedCert(opts: { domain: string; days?: number }): { certPem: string; keyPem: string }
```

- ECDSA P-256, CN and SAN DNS entry both set to the user's domain, default validity 3650 days.
- Writes to `output/<name>/certs/cert.pem` and `key.pem`.
- `server.json` references them via `streamSettings.tlsSettings.certificates[]` (`certificateFile`/`keyFile`,
  paths relative to the config).
- Validation rule flags a TLS inbound whose `certificates[]` paths don't resolve on disk.

### 5.5 Password (`crypto/password.ts`)

`base64url` of 24 random bytes. VLESS doesn't use it, but it's generated into the build context and
printed in README so v2 protocol modules (sing-box / Shadowsocks) plug in without touching the crypto layer.

---

## 6. Validation (`validate/`)

`configtools check` is a first-class command. Two layers, ordered so cheapest checks fail first,
each error pointing to the exact field.

### 6.1 Layer 1 — JSON Schema (structural)

Whole Xray config validated against a JSON Schema shipped in `engines/xray/schema.ts`, hand-written
from the 26.x transport source (covering `log`/`dns`/`routing`/`inbounds`/`outbounds` and the
streamSettings shapes for `raw`/`ws`/`grpc` + `tls`/`reality`). Powered by `ajv` + `ajv-formats`.

Catches: wrong types, unknown keys (`additionalProperties: false` where appropriate), missing required
fields, enum violations. Errors surfaced as `{ path, message }`, e.g.
`inbounds[0].streamSettings.realitySettings: missing required property "dest"`.

### 6.2 Layer 2 — Business rules (`validate/rules.ts`)

Run only after Layer 1 passes:

| Rule | Checks |
|---|---|
| Port range | `port` is 1–65535; warns if privileged port (<1024) |
| UUID format | every `clients[].id` matches RFC4122 v4 |
| Reality dest | `"host:port"` form; host is a domain (not the server's own IP/domain) |
| Reality serverNames | each entry's host appears in `dest`'s host (common misconfig) |
| Reality keys | server-side `privateKey` base64url-decodes to exactly 32 bytes (mirrors Xray's own check); client-facing `publicKey` in README, if shown, is the valid base64url key derived from the private key |
| shortIds | hex, even length, ≤16 chars |
| TLS certs | each `certificates[].certificateFile`/`keyFile` resolves to an existing file |
| Listen address | valid IP or `::` / empty |
| Routing refs | every `routing.rules[].outboundTag` exists in `outbounds[]`; `inboundTag` exists in `inbounds[]` |
| Duplicate ports | no two inbounds share the same `port` |

### 6.3 Result model & UX

```ts
interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;          // e.g. "inbounds[1].streamSettings.tlsSettings"
  message: string;
  hint?: string;         // how to fix
}
```

`check` prints a colored report (kleur). Exit code: `0` if no errors (warnings allowed), `1` if any
error — scriptable in CI.

---

## 7. Routing Presets

Fixed in v1, chosen during prompts:

- **`none`**: no `routing` block (or empty rules). All traffic → default `freedom` outbound.
- **`block-ads-cn`**: the common server-side preset from the reference scripts.
  - `outbounds`: `direct` (`freedom`), `block` (`blackhole`), `dns` (outbound to internal DNS).
  - `rules`: block ads (geosite:category-ads-all) and private/LAN addresses → `block`;
    geoip:private and geoip:cn → `direct`; geosite:cn → `direct`; everything else falls through
    to default outbound.
  - `dns` block: a `localhost` server with hosts mapping for `domain:geosite:cn` → local, plus
    a remote server for foreign domains. (Mirrors the fscarmen/yonggekkk server config pattern.)

A custom rule editor is deferred — presets cover the vast majority of server-side use.

---

## 8. Testing

Unit tests of pure functions with Vitest. No filesystem or terminal in unit tests (those layers are
thin shells; integration is manual / a single smoke test).

Covered:
- Each inbound module's `build()` produces a config that **passes its own validation**.
- `crypto/reality-keys.ts`: generated keypair decodes to 32 bytes, public derives from private.
- `crypto/short-id.ts`, `crypto/uuid.ts`, `crypto/password.ts`: format correctness.
- `cert/self-signed.ts`: produced PEM parses with `crypto.X509Certificate`; SAN/CN match input.
- `validate/rules.ts`: each rule with a passing and failing fixture.
- `format/json.ts`: idempotency (format ∘ format === format).

---

## 9. Dependencies & Tooling

**Runtime dependencies (minimal):**
- `prompts` — interactive prompts
- `ajv` + `ajv-formats` — JSON Schema validation
- `kleur` — colored terminal output

**Dev dependencies:**
- TypeScript, `tsx` (dev runner), Vitest, `@types/node`
- Build: `tsc` → `dist/`; `package.json` `bin` points to `dist/cli/index.js` with shebang.

**Engine:** Node 18+ (uses `crypto.randomUUID`, native X25519). Documented in `engines` field.

**npm:** published as `configtools`, runnable via `npx configtools`.

---

## 10. What v1 Delivers (acceptance checklist)

- [ ] `configtools new` interactively builds an Xray 26.3 server config choosing any combination of
      Reality / WS+TLS / gRPC+TLS inbounds.
- [ ] Auto-generates UUID, Reality keypair + shortIds, and (for WS/gRPC) an ECDSA P-256 self-signed cert.
- [ ] `configtools check <name>` validates `server.json` via JSON Schema + business rules, clear errors,
      scriptable exit codes.
- [ ] `configtools format <name>` reformats `server.json` stably/idempotently.
- [ ] `configtools edit <name>` reloads choices and rebuilds.
- [ ] `configtools list` shows projects.
- [ ] Output dir contains `server.json`, `project.json`, `README.md` (summary + share links), `certs/` (if needed).
- [ ] Unit tests pass; each module's output validates against the shipped schema.
- [ ] Generated `server.json` is loadable by a real Xray-core 26.x binary (manual smoke test, documented).

---

## 11. Roadmap (post-v1, for context — not in scope)

- **v2:** sing-box 1.13 engine (same registry shape under `engines/sing-box`).
- **v2:** Clash Verge client config generation from a project's client nodes.
- **v2:** Cloudflare Argo tunnel nodes (temp token + fixed domain) for WS inbounds.
- **v3:** additional protocols (VMess, Shadowsocks, Trojan); custom routing rule editor;
  schema-driven `engines/` extension points.
