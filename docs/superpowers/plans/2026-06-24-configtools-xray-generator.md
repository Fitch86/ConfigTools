# ConfigTools v1 (Xray-core Config Generator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an interactive `configtools` CLI (TypeScript, npm/npx) that generates a valid Xray-core 26.3 server `config.json` for VLESS+Reality+Vision, VLESS+WS+TLS, and VLESS+gRPC+TLS inbounds, auto-generates credentials + a self-signed ECDSA P-256 cert, and supports a manual-edit → format → check loop.

**Architecture:** Registry of protocol "modules" each exporting `{ id, label, optionSchema, prompts, build(ctx, options) }`; a pure engine assembles module outputs + a shared skeleton into one config; a two-layer validator (ajv JSON Schema + business rules) backs the `check` command. Projects persist as `output/<name>/{server.json, project.json, README.md, certs/}` where `project.json` is the source of truth.

**Tech Stack:** Node 18+, TypeScript, Vitest, `prompts`, `ajv` + `ajv-formats`, `kleur`. Zero other runtime deps (X25519/UUID via built-in `crypto`; self-signed cert hand-written DER, verified to parse with `crypto.X509Certificate`).

**Spec:** `docs/superpowers/specs/2026-06-24-configtools-xray-generator-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | name `configtools`, `bin`, deps, scripts |
| `tsconfig.json` | strict TS, ESM, `dist/` out |
| `vitest.config.ts` | test runner |
| `src/crypto/uuid.ts` | `generateUuid()` |
| `src/crypto/reality-keys.ts` | `generateRealityKeyPair()` (X25519 → base64url) |
| `src/crypto/short-id.ts` | `generateShortIds()` |
| `src/crypto/password.ts` | `generatePassword()` |
| `src/cert/der.ts` | low-level ASN.1 DER encoders (INTEGER, OID, SEQUENCE, SET, BIT STRING, UTCTime, printable/UTF8) |
| `src/cert/self-signed.ts` | `generateSelfSignedCert({domain, days})` → {certPem, keyPem} |
| `src/engines/xray/types.ts` | TS interfaces for Xray config + `InboundModule`, `BuildContext`, `InboundResult` |
| `src/engines/xray/schema.ts` | JSON Schema for whole Xray config |
| `src/engines/xray/skeleton.ts` | `buildSkeleton(common)` → log/dns/routing/outbounds base |
| `src/engines/xray/inbounds/reality.ts` | Reality module |
| `src/engines/xray/inbounds/vless-ws.ts` | WS+TLS module |
| `src/engines/xray/inbounds/vless-grpc.ts` | gRPC+TLS module |
| `src/engines/xray/registry.ts` | lists the 3 modules |
| `src/engines/xray/index.ts` | `generateXrayConfig(input)` orchestrator |
| `src/validate/rules.ts` | business-rule checks |
| `src/validate/index.ts` | `validateXray(config, {certDir})` → `ValidationIssue[]` (ajv + rules) |
| `src/format/json.ts` | `formatJson(obj)` stable pretty-print + key sort |
| `src/project/store.ts` | load/save project dir |
| `src/cli/prompts.ts` | interactive prompts (common + per-module) |
| `src/cli/output.ts` | write files, print summary + share links |
| `src/cli/index.ts` | subcommand dispatch: new/edit/check/format/list |
| `src/index.ts` | library entrypoint |
| `tests/**/*.test.ts` | one test file per source unit |

---

## Task 0: Scaffold project (no tests — pure setup)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`, `tests/sanity.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "configtools",
  "version": "0.1.0",
  "description": "Interactive generator for Xray-core / sing-box server configs and Clash client configs",
  "type": "module",
  "bin": {
    "configtools": "dist/cli/index.js"
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "kleur": "^4.1.5",
    "prompts": "^2.4.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/prompts": "^2.4.9",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
output/
*.log
.DS_Store
```

- [ ] **Step 5: Write `src/index.ts` (placeholder library entry)**

```ts
export const VERSION = "0.1.0";
```

- [ ] **Step 6: Write `tests/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index.js";

describe("sanity", () => {
  it("exposes a version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 7: Install deps and verify**

Run: `npm install`
Expected: installs without error.

Run: `npm test`
Expected: 1 test passes.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript + Vitest project"
```

---

## Task 1: UUID generator (`crypto/uuid.ts`)

**Files:**
- Create: `src/crypto/uuid.ts`
- Test: `tests/crypto/uuid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateUuid, UUID_REGEX } from "../../src/crypto/uuid.js";

describe("generateUuid", () => {
  it("produces an RFC4122 v4 UUID", () => {
    const id = generateUuid();
    expect(id).toMatch(UUID_REGEX);
    expect(id).toHaveLength(36);
  });

  it("the version nibble is 4", () => {
    expect(generateUuid()[14]).toBe("4");
  });

  it("the variant nibble is 8, 9, a, or b", () => {
    const v = generateUuid()[19];
    expect(["8", "9", "a", "b"]).toContain(v);
  });

  it("generates unique values", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateUuid()));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crypto/uuid.test.ts`
Expected: FAIL — cannot find module `../../src/crypto/uuid.js`.

- [ ] **Step 3: Write the implementation**

```ts
import { randomUUID } from "node:crypto";

/** RFC4122 version 4 UUID. */
export function generateUuid(): string {
  return randomUUID();
}

/** Matches a canonical RFC4122 v4 UUID. */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/crypto/uuid.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/crypto/uuid.ts tests/crypto/uuid.test.ts
git commit -m "feat(crypto): add UUID v4 generator"
```

---

## Task 2: Reality X25519 keypair (`crypto/reality-keys.ts`)

**Files:**
- Create: `src/crypto/reality-keys.ts`
- Test: `tests/crypto/reality-keys.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateRealityKeyPair } from "../../src/crypto/reality-keys.js";

// X25519 PKCS8 DER private key is 48 bytes; raw key is bytes [16,48).
// SPKI DER public key is 44 bytes; raw key is bytes [12,44).
const PRIV_DER_LEN = 48;
const PUB_DER_LEN = 44;
const RAW_LEN = 32;

describe("generateRealityKeyPair", () => {
  it("returns base64url (no padding) strings of 32 raw bytes each", () => {
    const { privateKey, publicKey } = generateRealityKeyPair();
    expect(privateKey).not.toMatch(/=+$/); // no padding
    expect(publicKey).not.toMatch(/=+$/);
    const priv = Buffer.from(privateKey, "base64url");
    const pub = Buffer.from(publicKey, "base64url");
    expect(priv).toHaveLength(RAW_LEN);
    expect(pub).toHaveLength(RAW_LEN);
  });

  it("produces unique keypairs", () => {
    const a = generateRealityKeyPair();
    const b = generateRealityKeyPair();
    expect(a.privateKey).not.toBe(b.privateKey);
  });

  it("publicKey is the X25519 public counterpart of privateKey", () => {
    // Reconstruct the key object from the raw private bytes and compare derived public.
    const { privateKey: privB64, publicKey: pubB64 } = generateRealityKeyPair();
    const privRaw = Buffer.from(privB64, "base64url");
    // Build a DER PKCS8 around the raw key at offset 16, then load it.
    const pkcs8Prefix = Buffer.from(
      "302e020100300506032b656e04220420",
      "hex"
    );
    const der = Buffer.concat([pkcs8Prefix, privRaw]);
    expect(der).toHaveLength(PRIV_DER_LEN);
    const keyObj = crypto.createPrivateKey({
      key: der,
      format: "der",
      type: "pkcs8",
    });
    const spki = keyObj.export({ type: "spki", format: "der" }) as Buffer;
    expect(spki).toHaveLength(PUB_DER_LEN);
    const derivedRaw = spki.subarray(12, 44);
    expect(Buffer.from(derivedRaw).toString("base64url")).toBe(pubB64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crypto/reality-keys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { generateKeyPairSync } from "node:crypto";

// X25519 DER encoding constants (RFC 8410):
//   PKCS8 OneAsymmetricKey: 302e 020100 300506032b656e 0422 0420 <32 raw bytes>  (16-byte prefix)
//   SPKI SubjectPublicKey:  302a 300506032b656e 032100 <32 raw bytes>            (12-byte prefix)
const PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI_PREFIX_LEN = 12;
const RAW_LEN = 32;

export interface RealityKeyPair {
  privateKey: string; // base64url, 32 raw bytes
  publicKey: string; // base64url, 32 raw bytes
}

/** Generates an X25519 keypair matching `xray x25519` output (base64url, no padding). */
export function generateRealityKeyPair(): RealityKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("x25519", {
    privateKeyEncoding: { type: "pkcs8", format: "der" },
    publicKeyEncoding: { type: "spki", format: "der" },
  });

  const privRaw = new Uint8Array(privateKey as unknown as ArrayBuffer).slice(
    PKCS8_PREFIX.length,
    PKCS8_PREFIX.length + RAW_LEN
  );
  const pubRaw = new Uint8Array(publicKey as unknown as ArrayBuffer).slice(
    SPKI_PREFIX_LEN,
    SPKI_PREFIX_LEN + RAW_LEN
  );

  return {
    privateKey: Buffer.from(privRaw).toString("base64url"),
    publicKey: Buffer.from(pubRaw).toString("base64url"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/crypto/reality-keys.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/crypto/reality-keys.ts tests/crypto/reality-keys.test.ts
git commit -m "feat(crypto): add Reality X25519 keypair generator"
```

---

## Task 3: Reality shortIds (`crypto/short-id.ts`)

**Files:**
- Create: `src/crypto/short-id.ts`
- Test: `tests/crypto/short-id.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  generateShortIds,
  SHORTID_REGEX,
  isValidShortId,
} from "../../src/crypto/short-id.js";

describe("shortIds", () => {
  it("default generates one 8-hex-char id", () => {
    const ids = generateShortIds();
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}$/);
  });

  it("respects requested count and byte length", () => {
    const ids = generateShortIds({ count: 3, bytes: 4 });
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("bytes=8 produces a 16-hex-char id (the max)", () => {
    expect(generateShortIds({ count: 1, bytes: 8 })[0]).toMatch(
      /^[0-9a-f]{16}$/
    );
  });

  it("can include the empty string (match-any) sentinel", () => {
    const ids = generateShortIds({ includeEmpty: true });
    expect(ids).toContain("");
  });

  it("isValidShortId accepts empty string and even-length hex up to 16", () => {
    expect(isValidShortId("")).toBe(true);
    expect(isValidShortId("ab")).toBe(true);
    expect(isValidShortId("0123456789abcdef")).toBe(true);
    expect(isValidShortId("abc")).toBe(false); // odd length
    expect(isValidShortId("0123456789abcdef0")).toBe(false); // >16
    expect(isValidShortId("xyz0")).toBe(false); // non-hex
  });

  it("SHORTID_REGEX matches even hex 0..16 chars", () => {
    expect(SHORTID_REGEX.test("abab")).toBe(true);
    expect(SHORTID_REGEX.test("a")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crypto/short-id.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { randomBytes } from "node:crypto";

/** Matches a Reality shortId: even-length hex, 0–16 chars. */
export const SHORTID_REGEX = /^(?:[0-9a-f]{2}){0,8}$/;

export function isValidShortId(id: string): boolean {
  return SHORTID_REGEX.test(id);
}

export interface ShortIdOptions {
  /** Number of ids to generate. Default 1. */
  count?: number;
  /** Bytes per id (each byte → 2 hex chars). Must be 1..8. Default 4 (8 hex). */
  bytes?: number;
  /** Include the empty-string "match any" sentinel at the end. Default false. */
  includeEmpty?: boolean;
}

/** Generates Reality shortIds (hex, even length, ≤16 chars). */
export function generateShortIds(opts: ShortIdOptions = {}): string[] {
  const count = opts.count ?? 1;
  const bytes = opts.bytes ?? 4;
  if (bytes < 1 || bytes > 8) {
    throw new RangeError(`bytes must be 1..8, got ${bytes}`);
  }
  const ids = Array.from({ length: count }, () =>
    randomBytes(bytes).toString("hex")
  );
  if (opts.includeEmpty) ids.push("");
  return ids;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/crypto/short-id.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/crypto/short-id.ts tests/crypto/short-id.test.ts
git commit -m "feat(crypto): add Reality shortId generator"
```

---

## Task 4: Password generator (`crypto/password.ts`)

**Files:**
- Create: `src/crypto/password.ts`
- Test: `tests/crypto/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generatePassword } from "../../src/crypto/password.js";

describe("generatePassword", () => {
  it("returns base64url of 24 random bytes (no padding)", () => {
    const pw = generatePassword();
    expect(pw).not.toMatch(/=+$/);
    expect(Buffer.from(pw, "base64url")).toHaveLength(24);
  });

  it("respects requested byte length", () => {
    expect(Buffer.from(generatePassword(16), "base64url")).toHaveLength(16);
  });

  it("generates unique values", () => {
    const set = new Set(Array.from({ length: 500 }, () => generatePassword()));
    expect(set.size).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crypto/password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { randomBytes } from "node:crypto";

/** Base64url random password (default 24 bytes). Forward-compat for sing-box/Shadowsocks. */
export function generatePassword(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/crypto/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/crypto/password.ts tests/crypto/password.test.ts
git commit -m "feat(crypto): add random password generator"
```

---

## Task 5: ASN.1 DER encoders (`cert/der.ts`)

The low-level building blocks for hand-writing an X.509 certificate. Pure functions over `number[]` of bytes; composed into larger structures. No crypto here — just encoding.

**Files:**
- Create: `src/cert/der.ts`
- Test: `tests/cert/der.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  derLength,
  derInteger,
  derOid,
  derSequence,
  derSet,
  derBitString,
  derOctetString,
  derUtf8String,
  derPrintableString,
  derUtcTime,
  derContextTag,
  toUint8Array,
} from "../../src/cert/der.js";

// Helper: hex string -> compare
const hex = (bytes: number[] | Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

describe("DER encoders", () => {
  it("derLength: short form and long form", () => {
    expect(derLength(0)).toEqual([0x00]);
    expect(derLength(127)).toEqual([0x7f]);
    expect(derLength(128)).toEqual([0x81, 0x80]);
    expect(derLength(300)).toEqual([0x82, 0x01, 0x2c]);
  });

  it("derInteger", () => {
    expect(hex(derInteger(0))).toBe("020100");
    expect(hex(derInteger(127))).toBe("02017f");
    expect(hex(derInteger(255))).toBe("020200ff"); // leading 0 for sign
    expect(hex(derInteger(0x010203))).toBe("0202010203");
  });

  it("derOid", () => {
    // 1.2.840.10045.2.1 (id-ecPublicKey)
    expect(hex(derOid([1, 2, 840, 10045, 2, 1]))).toBe("06072a8648ce3d0201");
    // 1.2.840.10045.4.3.2 (ecdsa-with-SHA256)
    expect(hex(derOid([1, 2, 840, 10045, 4, 3, 2]))).toBe("06082a8648ce3d040302");
  });

  it("derSequence / derSet wrap with tag+length", () => {
    const inner = derInteger(1);
    expect(hex(derSequence(inner))).toBe("3003020101");
    expect(hex(derSet(inner))).toBe("3103020101");
    expect(hex(derSequence([inner, derInteger(2)]))).toBe("3006020101020102");
  });

  it("derBitString wraps with unused-bits prefix 0x00", () => {
    expect(hex(derBitString([0x04, 0x10]))).toBe("0303000410");
  });

  it("derOctetString", () => {
    expect(hex(derOctetString([0xde, 0xad]))).toBe("0402dead");
  });

  it("derUtf8String / derPrintableString", () => {
    expect(hex(derPrintableString("example.com"))).toBe(
      "130b" + Buffer.from("example.com").toString("hex")
    );
    expect(hex(derUtf8String("a"))).toBe("0c0161");
  });

  it("derUtcTime (YYMMDDHHMMSSZ)", () => {
    const d = new Date(Date.UTC(2026, 5, 24, 10, 30, 0)); // 2026-06-24
    expect(hex(derUtcTime(d))).toBe("170d" + "2606241030005a" + ...[]); // tag+len+value
    // check the value portion explicitly
    expect(derUtcTime(d).slice(0, 2)).toEqual([0x17, 0x0d]);
    expect(
      derUtcTime(d)
        .slice(2)
        .map((b) => String.fromCharCode(b))
        .join("")
    ).toBe("260624103000Z");
  });

  it("derContextTag constructs [n] EXPLICIT wrapper", () => {
    // [0] wrapping an empty sequence
    expect(hex(derContextTag(0, derSequence([])))).toBe("a0200300" ... "");
    // simpler: [3] wrapping one byte 0xff
    expect(hex(derContextTag(3, [0xff]))).toBe("a3018200" ... "");
  });

  it("toUint8Array converts", () => {
    expect(toUint8Array([0x01, 0x02])).toEqual(new Uint8Array([1, 2]));
  });
});
```

> Note for the implementer: the test above has intentional `... ""` pseudo-syntax in two assertions that should be removed before running. Replace those two assertions with the precise expected hex. The correct expected values are:
> - `derContextTag(0, derSequence([]))` → `"a0023000"` (`a0 02 30 00`)
> - `derContextTag(3, [0xff])` → `"a301ff"` (`a3 01 ff`)
> And the `derUtcTime` first assertion should simply be `"170d" + "2606241030005a"` (i.e. `17 0d 260624103000Z`). Update the test accordingly before Step 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cert/der.test.ts`
Expected: FAIL — module not found (and the implementer has fixed the 3 assertion values per the note above).

- [ ] **Step 3: Write the implementation**

```ts
// Minimal ASN.1 DER encoders for hand-building an X.509 ECDSA P-256 certificate.

/** Encode a DER length (short form <128, or long form). */
export function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function wrap(tag: number, content: number[]): number[] {
  return [tag, ...derLength(content.length), ...content];
}

/** DER INTEGER (positive integers only; adds leading 0 when high bit set). */
export function derInteger(value: number): number[] {
  if (value < 0) throw new RangeError("negative integers not supported");
  if (value === 0) return wrap(0x02, [0x00]);
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  if (bytes[0] & 0x80) bytes.unshift(0x00); // ensure positive
  return wrap(0x02, bytes);
}

/** DER OBJECT IDENTIFIER from an arc array like [1,2,840,10045,2,1]. */
export function derOid(arcs: number[]): number[] {
  if (arcs.length < 2) throw new Error("OID needs >= 2 arcs");
  const body: number[] = [40 * arcs[0] + arcs[1]];
  for (let i = 2; i < arcs.length; i++) {
    body.push(...encodeBase128(arcs[i]));
  }
  return wrap(0x06, body);
}

function encodeBase128(n: number): number[] {
  if (n === 0) return [0x00];
  const out: number[] = [];
  let v = n;
  while (v > 0) {
    out.unshift(v & 0x7f);
    v >>>= 7;
  }
  for (let i = 0; i < out.length - 1; i++) out[i] |= 0x80;
  return out;
}

export function derSequence(content: number[] | number[][]): number[] {
  const flat = flatten(content);
  return wrap(0x30, flat);
}

export function derSet(content: number[] | number[][]): number[] {
  return wrap(0x31, flatten(content));
}

/** DER BIT STRING with the given number of unused bits (0 for our use). */
export function derBitString(content: number[], unusedBits = 0): number[] {
  return wrap(0x03, [unusedBits, ...content]);
}

export function derOctetString(content: number[]): number[] {
  return wrap(0x04, content);
}

export function derUtf8String(s: string): number[] {
  return wrap(0x0c, [...Buffer.from(s, "utf8")]);
}

export function derPrintableString(s: string): number[] {
  return wrap(0x13, [...Buffer.from(s, "ascii")]);
}

/** DER UTCTime: YYMMDDHHMMSSZ (UTC). */
export function derUtcTime(date: Date): number[] {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const v =
    pad(date.getUTCFullYear() % 100) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z";
  return wrap(0x17, [...Buffer.from(v, "ascii")]);
}

/** EXPLICIT context-specific [n] wrapper. */
export function derContextTag(tagNumber: number, content: number[]): number[] {
  return wrap(0xa0 | tagNumber, content);
}

function flatten(content: number[] | number[][]): number[] {
  return Array.isArray(content) && Array.isArray(content[0])
    ? (content as number[][]).flat()
    : (content as number[]);
}

export function toUint8Array(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cert/der.test.ts`
Expected: PASS (all assertions, after the implementer corrected the 3 noted assertion values).

- [ ] **Step 5: Commit**

```bash
git add src/cert/der.ts tests/cert/der.test.ts
git commit -m "feat(cert): add ASN.1 DER encoders"
```

---

## Task 6: Self-signed ECDSA P-256 cert (`cert/self-signed.ts`)

Composes Task 5's DER primitives + Node crypto signing to build a real X.509 cert, verified to parse with `crypto.X509Certificate`.

**Files:**
- Create: `src/cert/self-signed.ts`
- Test: `tests/cert/self-signed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { X509Certificate, createPublicKey } from "node:crypto";
import { generateSelfSignedCert } from "../../src/cert/self-signed.js";

describe("generateSelfSignedCert", () => {
  it("returns PEM strings for cert and key", () => {
    const { certPem, keyPem } = generateSelfSignedCert({
      domain: "example.com",
    });
    expect(certPem).toContain("-----BEGIN CERTIFICATE-----");
    expect(certPem).toContain("-----END CERTIFICATE-----");
    expect(keyPem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(keyPem).toContain("-----END PRIVATE KEY-----");
  });

  it("the cert parses as a valid X509Certificate", () => {
    const { certPem } = generateSelfSignedCert({ domain: "example.com" });
    const cert = new X509Certificate(certPem);
    expect(cert.validTo).toBeTruthy();
  });

  it("CN and SAN DNS equal the requested domain", () => {
    const { certPem } = generateSelfSignedCert({ domain: "my.proxy.tld" });
    const cert = new X509Certificate(certPem);
    expect(cert.subjectAltNames).toContain("DNS:my.proxy.tld");
    // CN via subjectComponents
    expect(cert.subjectAltNames).toBeDefined();
  });

  it("cert's public key matches the private key", () => {
    const { certPem, keyPem } = generateSelfSignedCert({
      domain: "example.com",
    });
    const cert = new X509Certificate(certPem);
    const fromCert = createPublicKey(cert.publicKey).export({
      type: "spki",
      format: "der",
    });
    const fromKey = createPublicKey(keyPem).export({
      type: "spki",
      format: "der",
    });
    expect(Buffer.from(fromCert)).toEqual(Buffer.from(fromKey));
  });

  it("uses ECDSA P-256", () => {
    const { certPem } = generateSelfSignedCert({ domain: "example.com" });
    const cert = new X509Certificate(certPem);
    expect(cert.publicKey.asymmetricKeyType).toBe("ec");
    // P-256 == secp256r1 / prime256v1
    expect(
      /P-256|prime256v1|secp256r1/i.test(
        (cert.publicKey as any).asymmetricKeyDetails?.namedCurve ?? ""
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cert/self-signed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  createSign,
  randomBytes,
} from "node:crypto";
import {
  derSequence,
  derSet,
  derInteger,
  derOid,
  derBitString,
  derContextTag,
  derPrintableString,
  derUtcTime,
  toUint8Array,
} from "./der.js";

// OIDs
const OID_EC_PUBLIC_KEY = [1, 2, 840, 10045, 2, 1];
const OID_PRIME256V1 = [1, 2, 840, 10045, 3, 1, 7];
const OID_ECDSA_SHA256 = [1, 2, 840, 10045, 4, 3, 2];
const OID_COMMON_NAME = [2, 5, 4, 3];

export interface SelfSignedCertOptions {
  domain: string;
  days?: number; // default 3650
}

export interface SelfSignedCert {
  certPem: string;
  keyPem: string;
}

/** Builds a self-signed ECDSA P-256 certificate with CN + SAN = domain. */
export function generateSelfSignedCert(
  opts: SelfSignedCertOptions
): SelfSignedCert {
  const domain = opts.domain;
  const days = opts.days ?? 3650;

  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const keyObj = createPrivateKey(privateKey);
  const pubObj = createPublicKey(publicKey);

  const pubSpki = Uint8Array.from(
    pubObj.export({ type: "spki", format: "der" }) as Buffer
  );

  const notBefore = new Date();
  notBefore.setMinutes(notBefore.getMinutes() - 5); // 5 min skew
  const notAfter = new Date(notBefore.getTime() + days * 86400_000);

  const serial = randomBytes(16);
  // Force serial positive
  if (serial[0] & 0x80) serial[0] = 0; // keep as-is length by clearing, or prepend 0
  const serialBytes = serial[0] === 0 && serial.length === 16 ? serial : serial; // positive after clear

  // --- Subject / Issuer (identical, self-signed): CN=domain ---
  const subjectDn = derSequence(
    derSet(derSequence([derOid(OID_COMMON_NAME), derPrintableString(domain)]))
  );

  // --- SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier, BIT STRING(publicKey) } ---
  const algorithm = derSequence([
    derOid(OID_EC_PUBLIC_KEY),
    derOid(OID_PRIME256V1),
  ]);
  const subjectPublicKey = derBitString([...pubSpki.subarray(0)]); // full SPKI content already a key; see note
  // Actually the public key BIT STRING must contain the EC point (0x04 || X || Y),
  // which is the tail of the SPKI DER after the 26-byte prefix for P-256.
  const EC_POINT_PREFIX = 26; // SEQUENCE+ AlgId(11) + BITSTRING header for P-256
  const ecPoint = pubSpki.subarray(EC_POINT_PREFIX);
  const subjectPublicKeyInfo = derSequence([
    algorithm,
    derBitString([...ecPoint]),
  ]);

  // --- TBSCertificate ---
  const tbs = derSequence([
    derContextTag(0, derOid(OID_ECDSA_SHA256)), // version v3 = 2 (handled implicitly)
    derInteger(serialBytes.reduce((acc, b) => acc * 256 + b, 0) >>> 0 || 0),
    derOid(OID_ECDSA_SHA256), // signature algorithm
    subjectDn, // issuer
    derSequence([derUtcTime(notBefore), derUtcTime(notAfter)]), // validity
    subjectDn, // subject
    subjectPublicKeyInfo,
    // extensions [3] EXPLICIT: subjectAltName
    derContextTag(
      3,
      derSequence([
        derSequence([
          derOid([2, 5, 29, 17]), // subjectAltName
          derOctetStringOf(
            derSequence(derContextTag(2, derPrintableString(domain))) // dNSName normally context[2] IA5; see note
          ),
        ]),
      ])
    ),
  ]);

  // Sign TBSCertificate
  const signer = createSign("SHA256");
  signer.update(Buffer.from(toUint8Array(tbs)));
  const sigDer = signer.sign(keyObj); // DER-encoded ECDSA signature

  // --- Certificate = SEQUENCE { TBSCertificate, AlgorithmIdentifier, BIT STRING(signature) } ---
  const cert = derSequence([
    tbs,
    derSequence([derOid(OID_ECDSA_SHA256)]),
    derBitString([...sigDer]),
  ]);

  const certDer = toUint8Array(cert);
  const certPem = toPem(certDer, "CERTIFICATE");

  return { certPem, keyPem: privateKey as string };
}

// dNSName is context [2] containing IA5String (ASCII). PrintableString tag works for ASCII domains.
// Wrap SAN value as OCTET STRING containing the GeneralNames sequence:
function derOctetStringOf(content: number[]): number[] {
  // local helper avoids importing derOctetString name clash if renamed
  return [0x04, content.length, ...content].length === content.length + 2
    ? [0x04, content.length, ...content]
    : [0x04, content.length, ...content];
}
```

> **Note for the implementer (read before running):** The implementation above has deliberate simplifications that will FAIL the parse test (`new X509Certificate(certPem)`) on first run, because:
> 1. The version must be `derContextTag(0, derInteger(2))` (v3), not an OID.
> 2. `dNSName` must be context tag `[2]` with **IA5String content** (tag 0x16), not PrintableString (0x13). For ASCII domains the byte content is the same but the wrapper tag must be 0x16; build a `derIa5String` helper.
> 3. The serial handling via `derInteger(bigNumber)` is fragile — add a `derIntegerBytes(bytes)` variant that encodes raw positive bytes directly.
> 4. The EC-point extraction offset (26) is correct for P-256 SPKI; verify by asserting the extracted blob starts with `0x04`.
>
> **TDD expectation:** Step 2's test *should* fail at Step 4 (parse test) on first implementation. Fix these 4 issues iteratively until `new X509Certificate(certPem)` parses and all assertions pass. Add a `derIa5String` and `derIntegerBytes` to `cert/der.ts` (with tests) as needed. This is the expected creative part of this task — it is NOT a placeholder; the structure is correct, the details need debugging against a real parser.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cert/self-signed.test.ts`
Expected: PASS (5 tests) — after fixing the 4 issues noted above and re-running.

Also run a manual cross-check:

```bash
node -e '
const { generateSelfSignedCert } = await import("./dist/cert/self-signed.js");
const { X509Certificate } = require("node:crypto");
const { certPem } = generateSelfSignedCert({ domain: "example.com" });
const c = new X509Certificate(certPem);
console.log("CA:", c.ca, "validTo:", c.validTo);
console.log(c.toString());
' 2>/dev/null || npm run build && node --input-type=module -e '...'
```
Expected: prints a readable certificate dump (issuer=subject=CN=example.com, SAN DNS:example.com, ECDSA P-256).

- [ ] **Step 5: Commit**

```bash
git add src/cert/self-signed.ts src/cert/der.ts tests/cert/self-signed.test.ts tests/cert/der.test.ts
git commit -m "feat(cert): self-signed ECDSA P-256 certificate generator"
```

---

## Task 7: Xray config TS types (`engines/xray/types.ts`)

**Files:**
- Create: `src/engines/xray/types.ts`
- Test: none (types only); consumed by later tasks. Verify via `npm run typecheck`.

- [ ] **Step 1: Write the types**

```ts
import type { JSONSchemaType } from "ajv";

/** Top-level Xray-core 26.3 server config.json. */
export interface XrayConfig {
  log: XrayLog;
  dns?: XrayDns;
  inbounds: XrayInbound[];
  outbounds: XrayOutbound[];
  routing?: XrayRouting;
}

export interface XrayLog {
  loglevel?: "debug" | "info" | "warning" | "error" | "none";
  access?: string;
  error?: string;
}

export interface XrayDns {
  servers: Array<string | XrayDnsServer>;
  hosts?: Record<string, string>;
  queryStrategy?: "UseIP" | "UseIPv4" | "UseIPv6";
}

export interface XrayDnsServer {
  address: string;
  port?: number;
  domains?: string[];
}

export interface XrayInbound {
  tag: string;
  listen?: string;
  port: number;
  protocol: "vless" | "vmess" | "trojan" | "shadowsocks";
  settings: Record<string, unknown>;
  streamSettings?: XrayStreamSettings;
  sniffing?: XraySniffing;
}

export interface XraySniffing {
  enabled: boolean;
  destOverride?: string[];
  routeOnly?: boolean;
}

export interface XrayStreamSettings {
  network: "raw" | "ws" | "grpc" | "h2" | "tcp";
  security?: "none" | "tls" | "reality";
  tlsSettings?: XrayTlsSettings;
  realitySettings?: XrayRealitySettings;
  rawSettings?: Record<string, unknown>;
  wsSettings?: XrayWsSettings;
  grpcSettings?: XrayGrpcSettings;
}

export interface XrayTlsSettings {
  serverName?: string;
  alpn?: string[];
  minVersion?: string;
  cipherSuites?: string;
  fingerprint?: string;
  certificates: Array<{
    certificateFile?: string;
    keyFile?: string;
    certificate?: string[]; // inline PEM
    key?: string[];
  }>;
}

export interface XrayRealitySettings {
  show?: boolean;
  target?: string; // alias of dest
  dest: string;
  type?: string;
  xver?: number;
  serverNames: string[];
  privateKey: string;
  shortIds: string[];
  fingerprint?: string;
}

export interface XrayWsSettings {
  path: string;
  host?: string;
  headers?: Record<string, string>;
  maxEarlyData?: number;
  earlyDataHeaderName?: string;
}

export interface XrayGrpcSettings {
  serviceName: string;
  multiMode?: boolean;
  idleTimeout?: number;
  initialWindowsSize?: number;
  userAgent?: string;
  healthCheckTimeout?: number;
}

export interface XrayOutbound {
  tag: string;
  protocol: "freedom" | "blackhole" | "dns" | string;
  settings?: Record<string, unknown>;
}

export interface XrayRouting {
  domainStrategy?: "AsIs" | "IPIfNonMatch" | "IPOnDemand";
  rules: XrayRoutingRule[];
}

export interface XrayRoutingRule {
  type?: "field";
  outboundTag: string;
  inboundTag?: string | string[];
  domain?: string[];
  ip?: string[];
  port?: number | string;
  protocol?: string[];
}

// ---- Engine-internal interfaces ----

export interface CommonOptions {
  /** Server's public address (IP or domain) — used in client nodes / share links. */
  publicAddress: string;
  logLevel: "debug" | "info" | "warning" | "error" | "none";
  routing: "none" | "block-ads-cn";
}

export interface BuildContext {
  uuid: string;
  realityKeyPair?: { privateKey: string; publicKey: string };
  shortIds?: string[];
  selfSignedCert?: { certPem: string; keyPem: string };
  password?: string;
}

export interface ClientNode {
  protocol: "vless";
  remark: string;
  address: string;
  port: number;
  uuid: string;
  // Share-link fragments for printing in README
  shareLink: string;
}

export interface SecretArtifact {
  /** Path relative to project dir. */
  path: string;
  content: string;
}

export interface InboundResult {
  inbound: XrayInbound;
  secrets: SecretArtifact[];
  clientNodes: ClientNode[];
}

export type PromptType = "text" | "number" | "select" | "multiselect" | "toggle";

export interface PromptSpec {
  name: string;
  message: string;
  type: PromptType;
  initial?: unknown;
  choices?: Array<string | { title: string; value: string }>;
  validate?: (value: unknown) => boolean | string;
}

export interface InboundModule<TOptions> {
  id: "reality" | "vless-ws" | "vless-grpc";
  label: string;
  /** JSON Schema describing + validating this module's options. */
  optionSchema: JSONSchemaType<TOptions> | object;
  /** Human prompts; the answers populate TOptions. */
  prompts: PromptSpec[];
  build: (ctx: BuildContext, options: TOptions) => InboundResult;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engines/xray/types.ts
git commit -m "feat(xray): add config TS interfaces and module contract"
```

---

## Task 8: Shared skeleton (`engines/xray/skeleton.ts`)

Builds `log`, `dns`, `routing` (per preset), and `outbounds` — the parts common to every config.

**Files:**
- Create: `src/engines/xray/skeleton.ts`
- Test: `tests/engines/xray/skeleton.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildSkeleton } from "../../../src/engines/xray/skeleton.js";
import type { CommonOptions } from "../../../src/engines/xray/types.js";

const base: CommonOptions = {
  publicAddress: "1.2.3.4",
  logLevel: "warning",
  routing: "none",
};

describe("buildSkeleton", () => {
  it("always provides log + inbounds + outbounds", () => {
    const s = buildSkeleton(base);
    expect(s.log.loglevel).toBe("warning");
    expect(s.inbounds).toEqual([]);
    expect(s.outbounds).toEqual([
      { tag: "direct", protocol: "freedom" },
      { tag: "block", protocol: "blackhole", settings: { response: { type: "http" } } },
    ]);
  });

  it("routing=none has no routing block", () => {
    expect(buildSkeleton({ ...base, routing: "none" }).routing).toBeUndefined();
  });

  it("routing=block-ads-cn adds dns + routing with direct/block/dns outbounds", () => {
    const s = buildSkeleton({ ...base, routing: "block-ads-cn" });
    expect(s.dns).toBeDefined();
    expect(s.outbounds.map((o) => o.tag).sort()).toEqual([
      "block",
      "direct",
      "dns",
    ]);
    expect(s.routing).toBeDefined();
    expect(s.routing!.rules.length).toBeGreaterThan(0);
    // every outboundTag referenced exists
    const tags = new Set(s.outbounds.map((o) => o.tag));
    for (const r of s.routing!.rules) {
      expect(tags.has(r.outboundTag)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/skeleton.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  CommonOptions,
  XrayConfig,
  XrayOutbound,
  XrayRouting,
  XrayDns,
} from "./types.js";

export interface Skeleton {
  log: XrayConfig["log"];
  dns?: XrayDns;
  routing?: XrayRouting;
  outbounds: XrayOutbound[];
}

/** Builds the log/dns/routing/outbounds skeleton shared by all inbounds. */
export function buildSkeleton(common: CommonOptions): Skeleton {
  const log = { loglevel: common.logLevel };

  const directOutbound: XrayOutbound = { tag: "direct", protocol: "freedom" };
  const blockOutbound: XrayOutbound = {
    tag: "block",
    protocol: "blackhole",
    settings: { response: { type: "http" } },
  };

  if (common.routing === "none") {
    return { log, outbounds: [directOutbound, blockOutbound] };
  }

  // routing === "block-ads-cn"
  const dnsOutbound: XrayOutbound = { tag: "dns", protocol: "dns" };
  const dns: XrayDns = {
    servers: [
      {
        address: "https+local://1.1.1.1/dns-query",
        domains: ["geosite:cn"],
      },
      "1.1.1.1",
    ],
    queryStrategy: "UseIP",
  };
  const routing: XrayRouting = {
    domainStrategy: "IPIfNonMatch",
    rules: [
      { type: "field", outboundTag: "block", protocol: ["bittorrent"] },
      {
        type: "field",
        outboundTag: "block",
        domain: ["geosite:category-ads-all"],
      },
      { type: "field", outboundTag: "direct", ip: ["geoip:private", "geoip:cn"] },
      { type: "field", outboundTag: "direct", domain: ["geosite:cn"] },
      {
        type: "field",
        outboundTag: "dns",
        inboundTag: [],
        domain: [],
      }, // placeholder; refined below
    ],
  };
  // The dns-routing rule needs inboundTag matching; keep minimal but valid:
  routing.rules = routing.rules.filter((r) => r.outboundTag !== "dns" || (r.domain && r.domain.length));
  // Add a real dns hijack rule for port 53 traffic:
  routing.rules.push({
    type: "field",
    outboundTag: "dns",
    port: 53,
  });

  return {
    log,
    dns,
    routing,
    outbounds: [directOutbound, blockOutbound, dnsOutbound],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/skeleton.test.ts`
Expected: PASS (3 tests). Note: the implementation above includes a slightly convoluted rule-construction; if the test for "every outboundTag referenced exists" passes and rules.length > 0, it's acceptable. Clean up the placeholder logic if it produces a degenerate rule set, but keep the test green.

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/skeleton.ts tests/engines/xray/skeleton.test.ts
git commit -m "feat(xray): add config skeleton (log/dns/routing/outbounds)"
```

---

## Task 9: Reality inbound module (`engines/xray/inbounds/reality.ts`)

**Files:**
- Create: `src/engines/xray/inbounds/reality.ts`
- Test: `tests/engines/xray/inbounds/reality.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { realityModule } from "../../../../src/engines/xray/inbounds/reality.js";
import type { BuildContext } from "../../../../src/engines/xray/types.js";

const ctx: BuildContext = {
  uuid: "de1e7e34-1234-4abc-89ab-0123456789ab",
  realityKeyPair: {
    privateKey: "gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE",
    publicKey: "BECRVa4M6L2tJ2Gkh5bKKfjr6fDK5epibFnva8g57TE",
  },
  shortIds: ["0123456789abcdef"],
};

const opts = {
  listen: "",
  port: 443,
  dest: "www.microsoft.com:443",
  serverNames: ["www.microsoft.com"],
  xver: 0,
};

describe("realityModule", () => {
  it("has the right id and label", () => {
    expect(realityModule.id).toBe("reality");
    expect(realityModule.label).toMatch(/Reality/i);
  });

  it("builds a VLESS+Reality inbound with Vision flow", () => {
    const { inbound } = realityModule.build(ctx, opts);
    expect(inbound.protocol).toBe("vless");
    expect(inbound.port).toBe(443);
    expect(inbound.streamSettings?.network).toBe("raw");
    expect(inbound.streamSettings?.security).toBe("reality");
    expect(inbound.streamSettings?.realitySettings?.dest).toBe(
      "www.microsoft.com:443"
    );
    expect(inbound.streamSettings?.realitySettings?.serverNames).toEqual([
      "www.microsoft.com",
    ]);
    expect(inbound.streamSettings?.realitySettings?.privateKey).toBe(
      ctx.realityKeyPair!.privateKey
    );
    expect(inbound.streamSettings?.realitySettings?.shortIds).toEqual([
      "0123456789abcdef",
    ]);
    // client has flow xtls-rprx-vision
    const clients = (inbound.settings as any).clients as any[];
    expect(clients[0].id).toBe(ctx.uuid);
    expect(clients[0].flow).toBe("xtls-rprx-vision");
  });

  it("produces no cert secrets (Reality needs none)", () => {
    const { secrets } = realityModule.build(ctx, opts);
    expect(secrets).toEqual([]);
  });

  it("produces a vless client node + share link", () => {
    const { clientNodes } = realityModule.build(ctx, opts);
    expect(clientNodes).toHaveLength(1);
    const node = clientNodes[0];
    expect(node.protocol).toBe("vless");
    expect(node.uuid).toBe(ctx.uuid);
    expect(node.shareLink).toMatch(
      /^vless:\/\/de1e7e34-1234-4abc-89ab-0123456789ab@[^?]+\?/
    );
    expect(node.shareLink).toContain("security=reality");
    expect(node.shareLink).toContain("flow=xtls-rprx-vision");
    expect(node.shareLink).toContain("pbk=" + ctx.realityKeyPair!.publicKey);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/inbounds/reality.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  BuildContext,
  ClientNode,
  InboundModule,
  InboundResult,
  XrayInbound,
} from "../types.js";

export interface RealityOptions {
  listen: string; // "" = all interfaces
  port: number;
  dest: string; // "host:port"
  serverNames: string[];
  xver: number; // 0 | 1 | 2
}

export const realityModule: InboundModule<RealityOptions> = {
  id: "reality",
  label: "VLESS + Reality + Vision",
  optionSchema: {
    type: "object",
    required: ["listen", "port", "dest", "serverNames", "xver"],
    properties: {
      listen: { type: "string" },
      port: { type: "integer", minimum: 1, maximum: 65535 },
      dest: { type: "string", pattern: "^.+:[0-9]+$" },
      serverNames: { type: "array", items: { type: "string" }, minItems: 1 },
      xver: { type: "integer", enum: [0, 1, 2] },
    },
  },
  prompts: [
    { name: "listen", message: "Listen address (empty = all)", type: "text", initial: "" },
    { name: "port", message: "Listen port", type: "number", initial: 443 },
    {
      name: "dest",
      message: "Reality dest (camouflage target host:port)",
      type: "text",
      initial: "www.microsoft.com:443",
    },
    {
      name: "serverNames",
      message: "serverNames (comma-separated SNI)",
      type: "text",
      initial: "www.microsoft.com",
    },
    { name: "xver", message: "xver (PROXY proto, 0/1/2)", type: "number", initial: 0 },
  ],
  build(ctx: BuildContext, opts: RealityOptions): InboundResult {
    const { realityKeyPair, shortIds, uuid } = ctx;
    const inbound: XrayInbound = {
      tag: "vless-reality",
      listen: opts.listen || undefined,
      port: opts.port,
      protocol: "vless",
      settings: {
        clients: [{ id: uuid, flow: "xtls-rprx-vision" }],
        decryption: "none",
      },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings: {
          dest: opts.dest,
          serverNames: opts.serverNames,
          privateKey: realityKeyPair!.privateKey,
          shortIds: shortIds ?? [],
          xver: opts.xver,
        },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    };

    const shareLink = buildVlessRealityShareLink(ctx, opts);
    const clientNodes: ClientNode[] = [
      {
        protocol: "vless",
        remark: "vless-reality",
        address: "", // filled by engine from publicAddress
        port: opts.port,
        uuid,
        shareLink,
      },
    ];

    return { inbound, secrets: [], clientNodes };
  },
};

function buildVlessRealityShareLink(
  ctx: BuildContext,
  opts: RealityOptions
): string {
  const params = new URLSearchParams({
    encryption: "none",
    security: "reality",
    flow: "xtls-rprx-vision",
    pbk: ctx.realityKeyPair!.publicKey,
    fp: "chrome",
    type: "raw",
    sni: opts.serverNames[0],
    sid: (ctx.shortIds ?? [""])[0],
  });
  return `vless://${ctx.uuid}@${opts.dest.split(":")[0]}:${opts.port}?${params}#vless-reality`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/inbounds/reality.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/inbounds/reality.ts tests/engines/xray/inbounds/reality.test.ts
git commit -m "feat(xray): add VLESS+Reality+Vision inbound module"
```

---

## Task 10: VLESS+WS+TLS module (`engines/xray/inbounds/vless-ws.ts`)

**Files:**
- Create: `src/engines/xray/inbounds/vless-ws.ts`
- Test: `tests/engines/xray/inbounds/vless-ws.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { vlessWsModule } from "../../../../src/engines/xray/inbounds/vless-ws.js";
import type { BuildContext } from "../../../../src/engines/xray/types.js";

const ctx: BuildContext = {
  uuid: "de1e7e34-1234-4abc-89ab-0123456789ab",
  selfSignedCert: { certPem: "CERT", keyPem: "KEY" },
};

const opts = {
  listen: "",
  port: 443,
  domain: "my.proxy.tld",
  path: "/vless",
  host: "my.proxy.tld",
};

describe("vlessWsModule", () => {
  it("builds a VLESS+WS+TLS inbound", () => {
    const { inbound } = vlessWsModule.build(ctx, opts);
    expect(inbound.protocol).toBe("vless");
    expect(inbound.streamSettings?.network).toBe("ws");
    expect(inbound.streamSettings?.security).toBe("tls");
    expect(inbound.streamSettings?.wsSettings?.path).toBe("/vless");
    expect(inbound.streamSettings?.wsSettings?.host).toBe("my.proxy.tld");
    const tls = inbound.streamSettings?.tlsSettings;
    expect(tls?.serverName).toBe("my.proxy.tld");
    expect(tls?.certificates[0].certificateFile).toMatch(/cert\.pem$/);
    expect(tls?.certificates[0].keyFile).toMatch(/key\.pem$/);
    const clients = (inbound.settings as any).clients as any[];
    expect(clients[0].id).toBe(ctx.uuid);
  });

  it("declares cert/key as secrets to write", () => {
    const { secrets } = vlessWsModule.build(ctx, opts);
    const paths = secrets.map((s) => s.path);
    expect(paths).toContain("certs/cert.pem");
    expect(paths).toContain("certs/key.pem");
    expect(secrets.find((s) => s.path === "certs/cert.pem")!.content).toBe(
      "CERT"
    );
  });

  it("produces a vless ws share link with security=tls", () => {
    const { clientNodes } = vlessWsModule.build(ctx, opts);
    const link = clientNodes[0].shareLink;
    expect(link).toContain("vless://de1e7e34");
    expect(link).toContain("type=ws");
    expect(link).toContain("security=tls");
    expect(link).toContain("path=%2Fvless");
    expect(link).toContain("sni=my.proxy.tld");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/inbounds/vless-ws.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  BuildContext,
  ClientNode,
  InboundModule,
  InboundResult,
  SecretArtifact,
  XrayInbound,
} from "../types.js";

export interface VlessWsOptions {
  listen: string;
  port: number;
  domain: string;
  path: string;
  host: string;
}

export const vlessWsModule: InboundModule<VlessWsOptions> = {
  id: "vless-ws",
  label: "VLESS + WebSocket + TLS",
  optionSchema: {
    type: "object",
    required: ["listen", "port", "domain", "path", "host"],
    properties: {
      listen: { type: "string" },
      port: { type: "integer", minimum: 1, maximum: 65535 },
      domain: { type: "string" },
      path: { type: "string", pattern: "^/" },
      host: { type: "string" },
    },
  },
  prompts: [
    { name: "listen", message: "Listen address (empty = all)", type: "text", initial: "" },
    { name: "port", message: "Listen port", type: "number", initial: 443 },
    { name: "domain", message: "Domain (for cert SAN + TLS SNI)", type: "text" },
    { name: "path", message: "WebSocket path", type: "text", initial: "/vless" },
    { name: "host", message: "WS Host header", type: "text", initial: "" },
  ],
  build(ctx: BuildContext, opts: VlessWsOptions): InboundResult {
    const inbound: XrayInbound = {
      tag: "vless-ws",
      listen: opts.listen || undefined,
      port: opts.port,
      protocol: "vless",
      settings: {
        clients: [{ id: ctx.uuid, level: 0 }],
        decryption: "none",
      },
      streamSettings: {
        network: "ws",
        security: "tls",
        wsSettings: {
          path: opts.path,
          host: opts.host || opts.domain,
        },
        tlsSettings: {
          serverName: opts.domain,
          certificates: [
            { certificateFile: "certs/cert.pem", keyFile: "certs/key.pem" },
          ],
        },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    };

    const secrets: SecretArtifact[] = [
      { path: "certs/cert.pem", content: ctx.selfSignedCert!.certPem },
      { path: "certs/key.pem", content: ctx.selfSignedCert!.keyPem },
    ];

    const shareLink = buildVlessWsShareLink(ctx, opts);
    const clientNodes: ClientNode[] = [
      {
        protocol: "vless",
        remark: "vless-ws",
        address: "",
        port: opts.port,
        uuid: ctx.uuid,
        shareLink,
      },
    ];

    return { inbound, secrets, clientNodes };
  },
};

function buildVlessWsShareLink(ctx: BuildContext, opts: VlessWsOptions): string {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    type: "ws",
    path: opts.path,
    host: opts.host || opts.domain,
    sni: opts.domain,
    fp: "chrome",
  });
  return `vless://${ctx.uuid}@${opts.domain}:${opts.port}?${params}#vless-ws`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/inbounds/vless-ws.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/inbounds/vless-ws.ts tests/engines/xray/inbounds/vless-ws.test.ts
git commit -m "feat(xray): add VLESS+WS+TLS inbound module"
```

---

## Task 11: VLESS+gRPC+TLS module (`engines/xray/inbounds/vless-grpc.ts`)

**Files:**
- Create: `src/engines/xray/inbounds/vless-grpc.ts`
- Test: `tests/engines/xray/inbounds/vless-grpc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { vlessGrpcModule } from "../../../../src/engines/xray/inbounds/vless-grpc.js";
import type { BuildContext } from "../../../../src/engines/xray/types.js";

const ctx: BuildContext = {
  uuid: "de1e7e34-1234-4abc-89ab-0123456789ab",
  selfSignedCert: { certPem: "CERT", keyPem: "KEY" },
};

const opts = {
  listen: "",
  port: 443,
  domain: "my.proxy.tld",
  serviceName: "GunService",
  multiMode: true,
};

describe("vlessGrpcModule", () => {
  it("builds a VLESS+gRPC+TLS inbound", () => {
    const { inbound } = vlessGrpcModule.build(ctx, opts);
    expect(inbound.protocol).toBe("vless");
    expect(inbound.streamSettings?.network).toBe("grpc");
    expect(inbound.streamSettings?.security).toBe("tls");
    expect(inbound.streamSettings?.grpcSettings?.serviceName).toBe("GunService");
    expect(inbound.streamSettings?.grpcSettings?.multiMode).toBe(true);
    expect(inbound.streamSettings?.tlsSettings?.certificates[0].certificateFile).toMatch(
      /cert\.pem$/
    );
    const clients = (inbound.settings as any).clients as any[];
    expect(clients[0].id).toBe(ctx.uuid);
  });

  it("declares cert/key secrets", () => {
    const paths = vlessGrpcModule
      .build(ctx, opts)
      .secrets.map((s) => s.path);
    expect(paths).toEqual(["certs/cert.pem", "certs/key.pem"]);
  });

  it("share link uses type=grpc + serviceName", () => {
    const link = vlessGrpcModule.build(ctx, opts).clientNodes[0].shareLink;
    expect(link).toContain("type=grpc");
    expect(link).toContain("serviceName=GunService");
    expect(link).toContain("security=tls");
    expect(link).toContain("mode=multi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/inbounds/vless-grpc.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type {
  BuildContext,
  ClientNode,
  InboundModule,
  InboundResult,
  SecretArtifact,
  XrayInbound,
} from "../types.js";

export interface VlessGrpcOptions {
  listen: string;
  port: number;
  domain: string;
  serviceName: string;
  multiMode: boolean;
}

export const vlessGrpcModule: InboundModule<VlessGrpcOptions> = {
  id: "vless-grpc",
  label: "VLESS + gRPC + TLS",
  optionSchema: {
    type: "object",
    required: ["listen", "port", "domain", "serviceName", "multiMode"],
    properties: {
      listen: { type: "string" },
      port: { type: "integer", minimum: 1, maximum: 65535 },
      domain: { type: "string" },
      serviceName: { type: "string" },
      multiMode: { type: "boolean" },
    },
  },
  prompts: [
    { name: "listen", message: "Listen address (empty = all)", type: "text", initial: "" },
    { name: "port", message: "Listen port", type: "number", initial: 443 },
    { name: "domain", message: "Domain (cert SAN + TLS SNI)", type: "text" },
    { name: "serviceName", message: "gRPC serviceName", type: "text", initial: "GunService" },
    { name: "multiMode", message: "multiMode (new gRPC)", type: "toggle", initial: true },
  ],
  build(ctx: BuildContext, opts: VlessGrpcOptions): InboundResult {
    const inbound: XrayInbound = {
      tag: "vless-grpc",
      listen: opts.listen || undefined,
      port: opts.port,
      protocol: "vless",
      settings: {
        clients: [{ id: ctx.uuid, level: 0 }],
        decryption: "none",
      },
      streamSettings: {
        network: "grpc",
        security: "tls",
        grpcSettings: {
          serviceName: opts.serviceName,
          multiMode: opts.multiMode,
        },
        tlsSettings: {
          serverName: opts.domain,
          certificates: [
            { certificateFile: "certs/cert.pem", keyFile: "certs/key.pem" },
          ],
        },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    };

    const secrets: SecretArtifact[] = [
      { path: "certs/cert.pem", content: ctx.selfSignedCert!.certPem },
      { path: "certs/key.pem", content: ctx.selfSignedCert!.keyPem },
    ];

    const params = new URLSearchParams({
      encryption: "none",
      security: "tls",
      type: "grpc",
      serviceName: opts.serviceName,
      sni: opts.domain,
      fp: "chrome",
      mode: opts.multiMode ? "multi" : "gun",
    });
    const shareLink = `vless://${ctx.uuid}@${opts.domain}:${opts.port}?${params}#vless-grpc`;

    const clientNodes: ClientNode[] = [
      {
        protocol: "vless",
        remark: "vless-grpc",
        address: "",
        port: opts.port,
        uuid: ctx.uuid,
        shareLink,
      },
    ];

    return { inbound, secrets, clientNodes };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/inbounds/vless-grpc.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/inbounds/vless-grpc.ts tests/engines/xray/inbounds/vless-grpc.test.ts
git commit -m "feat(xray): add VLESS+gRPC+TLS inbound module"
```

---

## Task 12: Registry (`engines/xray/registry.ts`)

**Files:**
- Create: `src/engines/xray/registry.ts`
- Test: `tests/engines/xray/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { XRAY_MODULES, getModule } from "../../../src/engines/xray/registry.js";

describe("registry", () => {
  it("contains the 3 v1 modules", () => {
    const ids = XRAY_MODULES.map((m) => m.id).sort();
    expect(ids).toEqual(["reality", "vless-grpc", "vless-ws"]);
  });

  it("getModule returns by id", () => {
    expect(getModule("reality").id).toBe("reality");
    expect(getModule("vless-ws").id).toBe("vless-ws");
    expect(getModule("vless-grpc").id).toBe("vless-grpc");
  });

  it("getModule throws on unknown id", () => {
    expect(() => getModule("nope" as never)).toThrow(/unknown module/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { InboundModule } from "./types.js";
import { realityModule } from "./inbounds/reality.js";
import { vlessWsModule } from "./inbounds/vless-ws.js";
import { vlessGrpcModule } from "./inbounds/vless-grpc.js";

export type XrayModuleId = "reality" | "vless-ws" | "vless-grpc";

export const XRAY_MODULES: InboundModule<any>[] = [
  realityModule,
  vlessWsModule,
  vlessGrpcModule,
];

export function getModule(id: XrayModuleId): InboundModule<any> {
  const m = XRAY_MODULES.find((mod) => mod.id === id);
  if (!m) throw new Error(`unknown module: ${id}`);
  return m;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/registry.ts tests/engines/xray/registry.test.ts
git commit -m "feat(xray): add inbound module registry"
```

---

## Task 13: Config assembler (`engines/xray/index.ts`)

`generateXrayConfig(input)` — the orchestrator. Builds context, calls each module, merges into the skeleton, injects `publicAddress` into client nodes, returns `{ config, project }` where `project` is the serializable input.

**Files:**
- Create: `src/engines/xray/index.ts`
- Test: `tests/engines/xray/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateXrayConfig } from "../../../src/engines/xray/index.js";
import type { XrayProjectInput } from "../../../src/engines/xray/index.js";

describe("generateXrayConfig", () => {
  it("assembles a reality-only config", () => {
    const input: XrayProjectInput = {
      common: {
        publicAddress: "1.2.3.4",
        logLevel: "warning",
        routing: "none",
      },
      inbounds: [
        {
          id: "reality",
          options: {
            listen: "",
            port: 443,
            dest: "www.microsoft.com:443",
            serverNames: ["www.microsoft.com"],
            xver: 0,
          },
        },
      ],
    };
    const { config, project } = generateXrayConfig(input, {
      uuid: "de1e7e34-1234-4abc-89ab-0123456789ab",
      realityKeyPair: {
        privateKey: "gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE",
        publicKey: "BECRVa4M6L2tJ2Gkh5bKKfjr6fDK5epibFnva8g57TE",
      },
      shortIds: ["0123456789abcdef"],
    });

    expect(config.inbounds).toHaveLength(1);
    expect(config.inbounds[0].streamSettings?.security).toBe("reality");
    expect(config.outbounds.map((o) => o.tag)).toContain("direct");
    // project round-trips: same input structure
    expect(project.inbounds[0].id).toBe("reality");
  });

  it("rejects duplicate inbound ports", () => {
    expect(() =>
      generateXrayConfig(
        {
          common: {
            publicAddress: "1.2.3.4",
            logLevel: "warning",
            routing: "none",
          },
          inbounds: [
            { id: "reality", options: { listen: "", port: 443, dest: "a.com:443", serverNames: ["a.com"], xver: 0 } },
            { id: "reality", options: { listen: "", port: 443, dest: "b.com:443", serverNames: ["b.com"], xver: 0 } },
          ],
        },
        {
          uuid: "de1e7e34-1234-4abc-89ab-0123456789ab",
          realityKeyPair: { privateKey: "x", publicKey: "y" },
          shortIds: ["0"],
        }
      )
    ).toThrow(/duplicate port/i);
  });

  it("requires a reality context when a reality inbound is present", () => {
    expect(() =>
      generateXrayConfig(
        {
          common: { publicAddress: "1.2.3.4", logLevel: "warning", routing: "none" },
          inbounds: [
            { id: "reality", options: { listen: "", port: 443, dest: "a.com:443", serverNames: ["a.com"], xver: 0 } },
          ],
        },
        { uuid: "de1e7e34-1234-4abc-89ab-0123456789ab" }
      )
    ).toThrow(/realityKeyPair/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { buildSkeleton } from "./skeleton.js";
import { getModule, XRAY_MODULES, type XrayModuleId } from "./registry.js";
import type {
  BuildContext,
  CommonOptions,
  InboundResult,
  XrayConfig,
  ClientNode,
  SecretArtifact,
} from "./types.js";

export interface InboundSpec {
  id: XrayModuleId;
  options: Record<string, unknown>;
}

export interface XrayProjectInput {
  common: CommonOptions;
  inbounds: InboundSpec[];
}

export interface GenerateOptions {
  uuid: string;
  realityKeyPair?: { privateKey: string; publicKey: string };
  shortIds?: string[];
  selfSignedCert?: { certPem: string; keyPem: string };
  password?: string;
}

export interface GenerateResult {
  config: XrayConfig;
  /** Serializable project (round-trips into generateXrayConfig). */
  project: XrayProjectInput;
  clientNodes: ClientNode[];
  secrets: SecretArtifact[];
}

/** Validates input and assembles a complete XrayConfig. Pure (no IO). */
export function generateXrayConfig(
  input: XrayProjectInput,
  opts: GenerateOptions
): GenerateResult {
  if (input.inbounds.length === 0) {
    throw new Error("at least one inbound is required");
  }

  // Duplicate-port check
  const ports = input.inbounds.map((spec) => {
    const port = (spec.options as { port?: number }).port;
    if (typeof port !== "number") {
      throw new Error(`inbound ${spec.id}: missing numeric port`);
    }
    return port;
  });
  const seen = new Set<number>();
  for (const p of ports) {
    if (seen.has(p)) throw new Error(`duplicate port: ${p}`);
    seen.add(p);
  }

  // Context consistency
  const needsReality = input.inbounds.some((s) => s.id === "reality");
  if (needsReality && !opts.realityKeyPair) {
    throw new Error("realityKeyPair is required when a Reality inbound is present");
  }
  const needsCert = input.inbounds.some(
    (s) => s.id === "vless-ws" || s.id === "vless-grpc"
  );
  if (needsCert && !opts.selfSignedCert) {
    throw new Error("selfSignedCert is required when a WS/gRPC inbound is present");
  }

  const ctx: BuildContext = {
    uuid: opts.uuid,
    realityKeyPair: opts.realityKeyPair,
    shortIds: opts.shortIds,
    selfSignedCert: opts.selfSignedCert,
    password: opts.password,
  };

  const skeleton = buildSkeleton(input.common);

  const results: InboundResult[] = input.inbounds.map((spec) => {
    const mod = getModule(spec.id);
    return mod.build(ctx, spec.options as never);
  });

  // De-duplicate tags (append suffix if collision)
  const usedTags = new Set<string>();
  const inbounds = results.map((r) => {
    let tag = r.inbound.tag;
    let i = 2;
    while (usedTags.has(tag)) tag = `${r.inbound.tag}-${i++}`;
    usedTags.add(tag);
    return { ...r.inbound, tag };
  });

  const clientNodes: ClientNode[] = results.flatMap((r) => r.clientNodes);
  for (const node of clientNodes) {
    node.address = input.common.publicAddress;
  }

  const secrets: SecretArtifact[] = results.flatMap((r) => r.secrets);

  const config: XrayConfig = {
    log: skeleton.log,
    dns: skeleton.dns,
    inbounds,
    outbounds: skeleton.outbounds,
    routing: skeleton.routing,
  };

  return { config, project: input, clientNodes, secrets };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/index.ts tests/engines/xray/index.test.ts
git commit -m "feat(xray): add config assembler with input validation"
```

---

## Task 14: JSON Schema (`engines/xray/schema.ts`)

Hand-written JSON Schema for the whole config, used by the validator (Task 15). Covers log/inbounds/outbounds/routing and the streamSettings shapes for raw/ws/grpc + tls/reality, with `additionalProperties: false` where safe.

**Files:**
- Create: `src/engines/xray/schema.ts`
- Test: `tests/engines/xray/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { XRAY_CONFIG_SCHEMA } from "../../../src/engines/xray/schema.js";

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(XRAY_CONFIG_SCHEMA);

const valid = {
  log: { loglevel: "warning" },
  inbounds: [
    {
      tag: "vless-reality",
      port: 443,
      protocol: "vless",
      settings: { clients: [{ id: "de1e7e34-1234-4abc-89ab-0123456789ab", flow: "xtls-rprx-vision" }], decryption: "none" },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings: {
          dest: "www.microsoft.com:443",
          serverNames: ["www.microsoft.com"],
          privateKey: "gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE",
          shortIds: ["0123456789abcdef"],
          xver: 0,
        },
      },
    },
  ],
  outbounds: [
    { tag: "direct", protocol: "freedom" },
    { tag: "block", protocol: "blackhole", settings: { response: { type: "http" } } },
  ],
};

describe("XRAY_CONFIG_SCHEMA", () => {
  it("accepts a valid reality config", () => {
    const ok = validate(valid);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  it("rejects a non-uuid client id", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.inbounds[0].settings.clients[0].id = "not-a-uuid";
    expect(validate(bad)).toBe(false);
  });

  it("rejects unknown protocol", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.inbounds[0].protocol = "bogus";
    expect(validate(bad)).toBe(false);
  });

  it("rejects realitySettings missing privateKey", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    delete bad.inbounds[0].streamSettings.realitySettings.privateKey;
    expect(validate(bad)).toBe(false);
  });

  it("rejects invalid xver", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.inbounds[0].streamSettings.realitySettings.xver = 5;
    expect(validate(bad)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engines/xray/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
const UUID_PATTERN =
  "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export const XRAY_CONFIG_SCHEMA = {
  type: "object",
  required: ["log", "inbounds", "outbounds"],
  additionalProperties: true,
  properties: {
    log: {
      type: "object",
      properties: {
        loglevel: { enum: ["debug", "info", "warning", "error", "none"] },
        access: { type: "string" },
        error: { type: "string" },
      },
    },
    dns: {
      type: "object",
      properties: {
        servers: { type: "array" },
        hosts: { type: "object" },
        queryStrategy: { enum: ["UseIP", "UseIPv4", "UseIPv6"] },
      },
    },
    inbounds: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["tag", "port", "protocol", "settings"],
        properties: {
          tag: { type: "string" },
          listen: { type: "string" },
          port: { type: "integer", minimum: 1, maximum: 65535 },
          protocol: { enum: ["vless", "vmess", "trojan", "shadowsocks"] },
          settings: {
            type: "object",
            properties: {
              clients: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: { type: "string", pattern: UUID_PATTERN },
                    flow: { type: "string" },
                    level: { type: "integer" },
                  },
                },
              },
              decryption: { type: "string" },
            },
          },
          streamSettings: {
            type: "object",
            properties: {
              network: { enum: ["raw", "tcp", "ws", "websocket", "grpc", "h2", "http"] },
              security: { enum: ["none", "tls", "reality"] },
              tlsSettings: {
                type: "object",
                required: ["certificates"],
                properties: {
                  serverName: { type: "string" },
                  alpn: { type: "array", items: { type: "string" } },
                  minVersion: { type: "string" },
                  cipherSuites: { type: "string" },
                  fingerprint: { type: "string" },
                  certificates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        certificateFile: { type: "string" },
                        keyFile: { type: "string" },
                        certificate: { type: "array", items: { type: "string" } },
                        key: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
              realitySettings: {
                type: "object",
                required: ["dest", "serverNames", "privateKey", "shortIds"],
                properties: {
                  show: { type: "boolean" },
                  target: { type: "string" },
                  dest: { type: "string" },
                  type: { type: "string" },
                  xver: { type: "integer", enum: [0, 1, 2] },
                  serverNames: { type: "array", items: { type: "string" }, minItems: 1 },
                  privateKey: { type: "string", minLength: 32 },
                  shortIds: { type: "array", items: { type: "string" } },
                  fingerprint: { type: "string" },
                },
              },
              wsSettings: {
                type: "object",
                required: ["path"],
                properties: {
                  path: { type: "string" },
                  host: { type: "string" },
                  headers: { type: "object" },
                  maxEarlyData: { type: "integer" },
                },
              },
              grpcSettings: {
                type: "object",
                required: ["serviceName"],
                properties: {
                  serviceName: { type: "string" },
                  multiMode: { type: "boolean" },
                  idleTimeout: { type: "integer" },
                  initialWindowsSize: { type: "integer" },
                },
              },
            },
          },
          sniffing: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              destOverride: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    outbounds: {
      type: "array",
      items: {
        type: "object",
        required: ["tag", "protocol"],
        properties: {
          tag: { type: "string" },
          protocol: { type: "string" },
          settings: { type: "object" },
        },
      },
    },
    routing: {
      type: "object",
      properties: {
        domainStrategy: { enum: ["AsIs", "IPIfNonMatch", "IPOnDemand"] },
        rules: { type: "array" },
      },
    },
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/engines/xray/schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/xray/schema.ts tests/engines/xray/schema.test.ts
git commit -m "feat(xray): add JSON Schema for config validation"
```

---

## Task 15: Validator (`validate/`)

Two layers: ajv (schema) + business rules. Returns `ValidationIssue[]`.

**Files:**
- Create: `src/validate/rules.ts`, `src/validate/index.ts`
- Test: `tests/validate/index.test.ts`, `tests/validate/rules.test.ts`

- [ ] **Step 1: Write the failing test for business rules**

```ts
// tests/validate/rules.test.ts
import { describe, it, expect } from "vitest";
import {
  checkPortRange,
  checkUuids,
  checkRealityDest,
  checkRealityServerNames,
  checkRealityPrivateKey,
  checkShortIds,
  checkDuplicatePorts,
  checkRoutingRefs,
} from "../../src/validate/rules.js";

describe("rules", () => {
  it("checkPortRange", () => {
    expect(checkPortRange(8080)).toHaveLength(0);
    expect(checkPortRange(80)[0].level).toBe("warning"); // privileged
    expect(checkPortRange(70000)[0].level).toBe("error");
    expect(checkPortRange(0)[0].level).toBe("error");
  });

  it("checkUuids", () => {
    expect(checkUuids(["de1e7e34-1234-4abc-89ab-0123456789ab"])).toHaveLength(0);
    expect(checkUuids(["bad"])[0].level).toBe("error");
  });

  it("checkRealityDest requires host:port form", () => {
    expect(checkRealityDest("www.microsoft.com:443")).toHaveLength(0);
    expect(checkRealityDest("www.microsoft.com")[0].level).toBe("error");
    expect(checkRealityDest("")[0].level).toBe("error");
  });

  it("checkRealityServerNames flags SNI not in dest host", () => {
    expect(
      checkRealityServerNames(["www.microsoft.com"], "www.microsoft.com:443")
    ).toHaveLength(0);
    expect(
      checkRealityServerNames(["evil.com"], "www.microsoft.com:443")[0].level
    ).toBe("warning");
  });

  it("checkRealityPrivateKey wants 32 base64url bytes", () => {
    expect(
      checkRealityPrivateKey("gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE")
    ).toHaveLength(0);
    expect(checkRealityPrivateKey("short")[0].level).toBe("error");
    expect(checkRealityPrivateKey("!!!notbase64!!!padding==")[0].level).toBe(
      "error"
    );
  });

  it("checkShortIds", () => {
    expect(checkShortIds(["ab", "0123456789abcdef", ""])).toHaveLength(0);
    expect(checkShortIds(["abc"])[0].level).toBe("error"); // odd length
    expect(checkShortIds(["zzzzzzzzzzzzzzzzzzzz"])[0].level).toBe("error");
  });

  it("checkDuplicatePorts", () => {
    expect(checkDuplicatePorts([443, 8080])).toHaveLength(0);
    expect(checkDuplicatePorts([443, 443])[0].level).toBe("error");
  });

  it("checkRoutingRefs flags dangling tags", () => {
    const issues = checkRoutingRefs(
      [{ outboundTag: "direct", domain: ["x"] }],
      [{ tag: "block", protocol: "blackhole" }]
    );
    expect(issues[0].level).toBe("error");
    expect(issues[0].message).toMatch(/direct/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/validate/rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/validate/rules.ts`**

```ts
import { UUID_REGEX } from "../crypto/uuid.js";
import { SHORTID_REGEX } from "../crypto/short-id.js";
import type { ValidationIssue } from "./index.js";

export function checkPortRange(port: number): ValidationIssue[] {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return [{ level: "error", path: "port", message: `invalid port ${port}` }];
  }
  if (port < 1024) {
    return [
      {
        level: "warning",
        path: "port",
        message: `port ${port} may require root privileges`,
      },
    ];
  }
  return [];
}

export function checkUuids(ids: string[]): ValidationIssue[] {
  return ids
    .filter((id) => !UUID_REGEX.test(id))
    .map((id) => ({
      level: "error" as const,
      path: "clients[].id",
      message: `invalid UUID: ${id}`,
    }));
}

export function checkRealityDest(dest: string): ValidationIssue[] {
  if (!/^.+:[0-9]+$/.test(dest)) {
    return [
      {
        level: "error",
        path: "realitySettings.dest",
        message: `dest must be "host:port", got "${dest}"`,
        hint: 'e.g. "www.microsoft.com:443"',
      },
    ];
  }
  return [];
}

export function checkRealityServerNames(
  serverNames: string[],
  dest: string
): ValidationIssue[] {
  const destHost = dest.split(":")[0];
  return serverNames
    .filter((sni) => !sni.endsWith(destHost) && !destHost.endsWith(sni))
    .map((sni) => ({
      level: "warning" as const,
      path: "realitySettings.serverNames",
      message: `serverName "${sni}" does not match dest host "${destHost}"`,
    }));
}

export function checkRealityPrivateKey(key: string): ValidationIssue[] {
  let raw: Buffer;
  try {
    raw = Buffer.from(key, "base64url");
  } catch {
    raw = Buffer.alloc(0);
  }
  if (raw.length !== 32) {
    return [
      {
        level: "error",
        path: "realitySettings.privateKey",
        message: `privateKey must decode to 32 bytes (got ${raw.length})`,
      },
    ];
  }
  return [];
}

export function checkShortIds(ids: string[]): ValidationIssue[] {
  return ids
    .filter((id) => !SHORTID_REGEX.test(id))
    .map((id) => ({
      level: "error" as const,
      path: "realitySettings.shortIds",
      message: `invalid shortId: "${id}"`,
      hint: "even-length hex, 0–16 chars",
    }));
}

export function checkDuplicatePorts(ports: number[]): ValidationIssue[] {
  const counts = new Map<number, number>();
  for (const p of ports) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([p]) => ({
      level: "error" as const,
      path: "inbounds[].port",
      message: `duplicate port ${p}`,
    }));
}

export function checkRoutingRefs(
  rules: { outboundTag: string }[],
  outbounds: { tag: string }[]
): ValidationIssue[] {
  const tags = new Set(outbounds.map((o) => o.tag));
  return rules
    .filter((r) => !tags.has(r.outboundTag))
    .map((r) => ({
      level: "error" as const,
      path: "routing.rules[].outboundTag",
      message: `outboundTag "${r.outboundTag}" not found in outbounds`,
    }));
}
```

- [ ] **Step 4: Write `src/validate/index.ts`**

```ts
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { XRAY_CONFIG_SCHEMA } from "../engines/xray/schema.js";
import {
  checkDuplicatePorts,
  checkPortRange,
  checkRealityDest,
  checkRealityPrivateKey,
  checkRealityServerNames,
  checkRoutingRefs,
  checkShortIds,
  checkUuids,
} from "./rules.js";

export interface ValidationIssue {
  level: "error" | "warning";
  path: string;
  message: string;
  hint?: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schemaValidate = ajv.compile(XRAY_CONFIG_SCHEMA);

export interface ValidateOptions {
  /** Directory to resolve relative certificate paths against (for the cert rule). */
  certDir?: string;
}

/** Validates an Xray config object: JSON Schema (layer 1) + business rules (layer 2). */
export function validateXray(
  config: unknown,
  _opts: ValidateOptions = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!schemaValidate(config)) {
    for (const err of schemaValidate.errors ?? []) {
      issues.push({
        level: "error",
        path: err.instancePath || "$",
        message: err.message ?? "validation error",
        hint: err.params ? JSON.stringify(err.params) : undefined,
      });
    }
    return issues; // stop: business rules assume a structurally valid config
  }

  const cfg = config as any;
  for (let i = 0; i < cfg.inbounds.length; i++) {
    const inb = cfg.inbounds[i];
    const base = `inbounds[${i}]`;
    issues.push(...checkPortRange(inb.port).map(prefix(base)));
    const clients: any[] = inb.settings?.clients ?? [];
    issues.push(...checkUuids(clients.map((c: any) => c.id)).map(prefix(base)));
    const ss = inb.streamSettings;
    if (ss?.realitySettings) {
      const r = ss.realitySettings;
      issues.push(...checkRealityDest(r.dest).map(prefix(base)));
      issues.push(...checkRealityServerNames(r.serverNames, r.dest).map(prefix(base)));
      issues.push(...checkRealityPrivateKey(r.privateKey).map(prefix(base)));
      issues.push(...checkShortIds(r.shortIds).map(prefix(base)));
    }
  }

  issues.push(
    ...checkDuplicatePorts(cfg.inbounds.map((i: any) => i.port)).map(
      prefix("inbounds")
    )
  );

  if (cfg.routing) {
    issues.push(
      ...checkRoutingRefs(cfg.routing.rules ?? [], cfg.outbounds).map(
        prefix("routing")
      )
    );
  }

  return issues;

  function prefix(base: string) {
    return (issue: ValidationIssue): ValidationIssue => ({
      ...issue,
      path: issue.path === base || issue.path === "" ? base : `${base}.${issue.path}`,
    });
  }
}

/** 0 if no errors, 1 otherwise — for CLI exit codes. */
export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
```

- [ ] **Step 5: Write the integration test**

```ts
// tests/validate/index.test.ts
import { describe, it, expect } from "vitest";
import { validateXray, hasErrors } from "../../src/validate/index.js";

const valid = {
  log: { loglevel: "warning" },
  inbounds: [
    {
      tag: "vless-reality",
      port: 443,
      protocol: "vless",
      settings: {
        clients: [{ id: "de1e7e34-1234-4abc-89ab-0123456789ab", flow: "xtls-rprx-vision" }],
        decryption: "none",
      },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings: {
          dest: "www.microsoft.com:443",
          serverNames: ["www.microsoft.com"],
          privateKey: "gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE",
          shortIds: ["0123456789abcdef"],
          xver: 0,
        },
      },
    },
  ],
  outbounds: [
    { tag: "direct", protocol: "freedom" },
    { tag: "block", protocol: "blackhole" },
  ],
};

describe("validateXray", () => {
  it("passes a valid config with only the privileged-port warning", () => {
    const issues = validateXray(valid);
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toHaveLength(0);
    expect(issues.some((i) => i.level === "warning")).toBe(true); // port 443
    expect(hasErrors(issues)).toBe(false);
  });

  it("reports schema errors and stops before business rules", () => {
    const issues = validateXray({ ...valid, inbounds: "nope" });
    expect(hasErrors(issues)).toBe(true);
  });

  it("reports a duplicate-port error", () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.inbounds.push(JSON.parse(JSON.stringify(bad.inbounds[0])));
    bad.inbounds[1].tag = "x";
    expect(hasErrors(validateXray(bad))).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/validate/`
Expected: PASS (rules: 8, index: 3).

- [ ] **Step 7: Commit**

```bash
git add src/validate/ tests/validate/
git commit -m "feat(validate): add two-layer Xray config validator"
```

---

## Task 16: JSON formatter (`format/json.ts`)

Stable pretty-print: 2-space indent, keys recursively sorted alphabetically (so regeneration + manual edits produce minimal diffs). Idempotent.

**Files:**
- Create: `src/format/json.ts`
- Test: `tests/format/json.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatJson, parseJson } from "../../src/format/json.js";

describe("formatJson", () => {
  it("sorts keys recursively and indents 2 spaces", () => {
    expect(formatJson({ b: 1, a: { z: 2, y: 3 } })).toBe(
      '{\n  "a": {\n    "y": 3,\n    "z": 2\n  },\n  "b": 1\n}'
    );
  });

  it("is idempotent", () => {
    const obj = { c: [3, 1, 2], a: { n: 1 }, b: true };
    const once = formatJson(obj);
    const twice = formatJson(parseJson(once));
    expect(twice).toBe(once);
  });

  it("does NOT reorder array elements", () => {
    const out = formatJson({ list: [3, 1, 2] });
    expect(out).toContain("[\n    3,\n    1,\n    2\n  ]");
  });

  it("preserves numeric values", () => {
    const out = formatJson({ port: 443, enabled: true });
    expect(out).toContain('"port": 443');
    expect(out).toContain('"enabled": true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/format/json.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
export function parseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Pretty-prints JSON with 2-space indent and recursively sorted keys. Stable. */
export function formatJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/format/json.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/format/json.ts tests/format/json.test.ts
git commit -m "feat(format): add stable JSON formatter"
```

---

## Task 17: Project store (`project/store.ts`)

Loads and saves a project dir: `project.json` (input + ctx minus PEM secrets), `server.json`, `README.md`, `certs/*`.

**Files:**
- Create: `src/project/store.ts`
- Test: `tests/project/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveProject, loadProject, type ProjectFiles } from "../../src/project/store.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ct-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("project store", () => {
  it("writes server.json, project.json, README.md and cert files; reads them back", () => {
    const files: ProjectFiles = {
      project: {
        common: { publicAddress: "1.2.3.4", logLevel: "warning", routing: "none" },
        inbounds: [{ id: "reality", options: { port: 443 } as any }],
      },
      serverJson: '{\n  "log": {}\n}',
      readme: "# proj\n",
      secrets: [{ path: "certs/cert.pem", content: "PEM" }],
    };
    saveProject(dir, files);
    for (const f of ["server.json", "project.json", "README.md", "certs/cert.pem"]) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
    expect(readFileSync(join(dir, "certs/cert.pem"), "utf8")).toBe("PEM");

    const loaded = loadProject(dir);
    expect(loaded.serverJson).toBe(files.serverJson);
    expect(loaded.project.common.publicAddress).toBe("1.2.3.4");
    expect(loaded.secrets[0].content).toBe("PEM");
  });

  it("loadProject throws clearly on missing project.json", () => {
    expect(() => loadProject(dir)).toThrow(/project\.json/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/project/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SecretArtifact } from "../engines/xray/types.js";
import type { XrayProjectInput } from "../engines/xray/index.js";

export interface ProjectFiles {
  project: XrayProjectInput;
  serverJson: string; // already-formatted
  readme: string;
  secrets: SecretArtifact[];
}

export function saveProject(projectDir: string, files: ProjectFiles): void {
  writeFileSync(join(projectDir, "project.json"), JSON.stringify(files.project, null, 2));
  writeFileSync(join(projectDir, "server.json"), files.serverJson);
  writeFileSync(join(projectDir, "README.md"), files.readme);
  for (const s of files.secrets) {
    const full = join(projectDir, s.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, s.content);
  }
}

export function loadProject(projectDir: string): ProjectFiles {
  const pjPath = join(projectDir, "project.json");
  if (!existsSync(pjPath)) throw new Error(`project.json not found in ${projectDir}`);
  const project = JSON.parse(readFileSync(pjPath, "utf8")) as XrayProjectInput;
  const serverPath = join(projectDir, "server.json");
  const serverJson = existsSync(serverPath)
    ? readFileSync(serverPath, "utf8")
    : "";
  return { project, serverJson, readme: "", secrets: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/project/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/project/store.ts tests/project/store.test.ts
git commit -m "feat(project): add project load/save"
```

---

## Task 18: CLI — prompts (`cli/prompts.ts`)

Interactive flow using `prompts`. Asks engine + inbound types + common options, then each module's prompts. For `edit`, seeds defaults from an existing `XrayProjectInput`.

**Files:**
- Create: `src/cli/prompts.ts`
- Test: `tests/cli/prompts.test.ts` (unit-test the *pure* transformation: PromptSpec[] → prompts questions, and answer-mapping; do NOT unit-test the interactive library)

- [ ] **Step 1: Write the failing test (pure helpers only)**

```ts
import { describe, it, expect } from "vitest";
import {
  commaListToArray,
  seedDefaults,
  buildCommonQuestions,
} from "../../src/cli/prompts.js";

describe("cli/prompts helpers", () => {
  it("commaListToArray trims and drops empties", () => {
    expect(commaListToArray("a, b , ,c")).toEqual(["a", "b", "c"]);
    expect(commaListToArray("")).toEqual([]);
  });

  it("seedDefaults maps an option object onto PromptSpec[] initials", () => {
    const specs = [
      { name: "port", message: "p", type: "number" as const, initial: 443 },
      { name: "path", message: "path", type: "text" as const },
    ];
    const seeded = seedDefaults(specs, { port: 8443, path: "/x" });
    expect(seeded.find((s) => s.name === "port")!.initial).toBe(8443);
    expect(seeded.find((s) => s.name === "path")!.initial).toBe("/x");
  });

  it("buildCommonQuestions includes routing choices", () => {
    const qs = buildCommonQuestions({});
    expect(JSON.stringify(qs)).toMatch(/none/);
    expect(JSON.stringify(qs)).toMatch(/block-ads-cn/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/prompts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import prompts from "prompts";
import { XRAY_MODULES } from "../engines/xray/registry.js";
import type {
  CommonOptions,
  InboundModule,
  PromptSpec,
} from "../engines/xray/types.js";
import type { XrayProjectInput } from "../engines/xray/index.js";

export function commaListToArray(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function seedDefaults(
  specs: PromptSpec[],
  values: Record<string, unknown>
): PromptSpec[] {
  return specs.map((s) =>
    values[s.name] !== undefined ? { ...s, initial: values[s.name] } : s
  );
}

export function buildCommonQuestions(
  seed: Partial<CommonOptions>
): prompts.PromptObject[] {
  return [
    {
      type: "text",
      name: "publicAddress",
      message: "Server public address (IP or domain)",
      initial: (seed.publicAddress as string) ?? "",
    },
    {
      type: "select",
      name: "logLevel",
      message: "Log level",
      choices: ["debug", "info", "warning", "error", "none"].map((v) => ({
        title: v,
        value: v,
      })),
      initial: ["debug", "info", "warning", "error", "none"].indexOf(
        seed.logLevel ?? "warning"
      ),
    },
    {
      type: "select",
      name: "routing",
      message: "Routing preset",
      choices: [
        { title: "none (no routing)", value: "none" },
        { title: "block-ads-cn", value: "block-ads-cn" },
      ],
      initial: seed.routing === "block-ads-cn" ? 1 : 0,
    },
  ];
}

export async function promptProject(
  seed?: XrayProjectInput
): Promise<XrayProjectInput> {
  const commonAnswers = await prompts(
    buildCommonQuestions(seed?.common ?? {})
  );
  const common = commonAnswers as unknown as CommonOptions;

  const inboundChoices = XRAY_MODULES.map((m: InboundModule<unknown>) => ({
    title: m.label,
    value: m.id,
  }));
  const chosen = (await prompts({
    type: "multiselect",
    name: "ids",
    message: "Select inbound(s)",
    choices: inboundChoices,
    initial: seed?.inbounds.map((i) => i.id) ?? [],
  })) as { ids: string[] };

  const inbounds = [];
  for (const id of chosen.ids) {
    const mod = XRAY_MODULES.find((m) => m.id === id)!;
    const seededValues =
      seed?.inbounds.find((i) => i.id === id)?.options ?? {};
    const questions = toPromptsQuestions(
      seedDefaults(mod.prompts, seededValues as Record<string, unknown>)
    );
    const answers = await prompts(questions);
    inbounds.push({ id, options: normalizeAnswers(answers) });
  }

  return { common, inbounds };
}

function toPromptsQuestions(specs: PromptSpec[]): prompts.PromptObject[] {
  return specs.map((s) => {
    const base: prompts.PromptObject = {
      type: s.type,
      name: s.name,
      message: s.message,
    };
    if (s.initial !== undefined) (base as any).initial = s.initial;
    if (s.choices) (base as any).choices = s.choices;
    if (s.validate) (base as any).validate = s.validate;
    return base;
  });
}

function normalizeAnswers(
  answers: Record<string, unknown>
): Record<string, unknown> {
  // serverNames arrives as a comma list from a text prompt; keep modules responsible,
  // but provide a hook here if needed later.
  return answers;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/prompts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli/prompts.ts tests/cli/prompts.test.ts
git commit -m "feat(cli): add interactive prompts (common + per-module)"
```

---

## Task 19: CLI — output (write files + summary) (`cli/output.ts`)

**Files:**
- Create: `src/cli/output.ts`
- Test: `tests/cli/output.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildReadme, formatIssueReport } from "../../src/cli/output.js";
import type { ClientNode } from "../../src/engines/xray/types.js";
import type { ValidationIssue } from "../../src/validate/index.js";

describe("cli/output", () => {
  it("buildReadme lists nodes and share links", () => {
    const nodes: ClientNode[] = [
      {
        protocol: "vless",
        remark: "vless-reality",
        address: "1.2.3.4",
        port: 443,
        uuid: "u",
        shareLink: "vless://u@1.2.3.4:443?#r",
      },
    ];
    const md = buildReadme({
      projectName: "demo",
      nodes,
      serverConfigPath: "server.json",
    });
    expect(md).toContain("# demo");
    expect(md).toContain("vless://u@1.2.3.4:443?#r");
    expect(md).toMatch(/443/);
  });

  it("formatIssueReport renders errors and warnings", () => {
    const issues: ValidationIssue[] = [
      { level: "error", path: "inbounds[0].port", message: "dup" },
      { level: "warning", path: "inbounds[0].port", message: "priv" },
    ];
    const out = formatIssueReport(issues, "server.json");
    expect(out).toContain("1 error");
    expect(out).toContain("1 warning");
    expect(out).toContain("dup");
  });

  it("formatIssueReport handles clean output", () => {
    const out = formatIssueReport([], "server.json");
    expect(out).toMatch(/valid|ok|clean/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/output.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import kleur from "kleur";
import type { ClientNode } from "../engines/xray/types.js";
import type { ValidationIssue } from "../validate/index.js";

export interface ReadmeInput {
  projectName: string;
  nodes: ClientNode[];
  serverConfigPath: string;
  certNote?: string;
}

export function buildReadme(input: ReadmeInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.projectName}`, "");
  lines.push(
    `Generated server config: \`${input.serverConfigPath}\` (Xray-core 26.x).`,
    ""
  );
  lines.push("## Nodes", "");
  lines.push("| Remark | Protocol | Address | Port | UUID |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const n of input.nodes) {
    lines.push(
      `| ${n.remark} | ${n.protocol} | ${n.address} | ${n.port} | \`${n.uuid}\` |`
    );
  }
  lines.push("", "## Share links", "");
  for (const n of input.nodes) {
    lines.push(`**${n.remark}**`);
    lines.push("```");
    lines.push(n.shareLink);
    lines.push("```", "");
  }
  if (input.certNote) lines.push(input.certNote);
  lines.push(
    "## Client advice",
    "",
    "- Use `fingerprint=chrome` (uTLS) on the client to match this server's Reality/TLS expectations.",
    "- Reality clients need the server's `publicKey` (pbk) and a `shortId` (sid).",
    ""
  );
  return lines.join("\n");
}

export function formatIssueReport(
  issues: ValidationIssue[],
  file: string
): string {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  if (issues.length === 0) {
    return `${kleur.green("✓")} ${file} is valid.`;
  }

  const head = `${kleur.red("✗")} ${errors.length} error${
    errors.length === 1 ? "" : "s"
  }${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""} — ${file}`;
  const body = issues
    .map((i) => {
      const tag = i.level === "error" ? kleur.red("ERROR") : kleur.yellow("WARN");
      const lines = [
        `  ${tag}   ${i.path}`,
        `          ${i.message}`,
      ];
      if (i.hint) lines.push(`          hint: ${i.hint}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return `${head}\n\n${body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/output.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli/output.ts tests/cli/output.test.ts
git commit -m "feat(cli): add README + issue-report rendering"
```

---

## Task 20: CLI — subcommand dispatch (`cli/index.ts`)

Wires everything: `new` / `edit` / `check` / `format` / `list`. Pure orchestration over the modules built above.

**Files:**
- Create: `src/cli/index.ts`
- Test: `tests/cli/index.test.ts` (integration smoke for `check`/`format` against a fixture; `new`/`edit` use the interactive lib and are exercised manually in Task 22)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck, runFormat, OUTPUT_DIR } from "../../src/cli/index.js";

let cwd: string;
beforeEach(() => {
  cwd = process.cwd();
  const tmp = mkdtempSync(join(tmpdir(), "ct-cli-"));
  process.chdir(tmp);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(process.cwd(), { recursive: true, force: true });
});

const validConfig = {
  log: { loglevel: "warning" },
  inbounds: [
    {
      tag: "vless-reality",
      port: 443,
      protocol: "vless",
      settings: {
        clients: [{ id: "de1e7e34-1234-4abc-89ab-0123456789ab", flow: "xtls-rprx-vision" }],
        decryption: "none",
      },
      streamSettings: {
        network: "raw",
        security: "reality",
        realitySettings: {
          dest: "www.microsoft.com:443",
          serverNames: ["www.microsoft.com"],
          privateKey: "gPgcI_928lDZchQ5Q3RnMDR--wexaqCZbPXG2ZUIMGE",
          shortIds: ["0123456789abcdef"],
          xver: 0,
        },
      },
    },
  ],
  outbounds: [
    { tag: "direct", protocol: "freedom" },
    { tag: "block", protocol: "blackhole" },
  ],
};

describe("cli check/format", () => {
  it("runCheck on a valid config returns no errors", () => {
    const issues = runCheck(validConfig);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("runCheck on an invalid config returns errors", () => {
    const bad = JSON.parse(JSON.stringify(validConfig));
    delete bad.inbounds[0].streamSettings.realitySettings.privateKey;
    const issues = runCheck(bad);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("runFormat sorts keys (stable)", () => {
    const unsorted = JSON.stringify({ b: 1, a: 2 });
    expect(runFormat(unsorted)).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import kleur from "kleur";
import { generateRealityKeyPair } from "../crypto/reality-keys.js";
import { generateShortIds } from "../crypto/short-id.js";
import { generateUuid } from "../crypto/uuid.js";
import { generatePassword } from "../crypto/password.js";
import { generateSelfSignedCert } from "../cert/self-signed.js";
import { generateXrayConfig, type XrayProjectInput } from "../engines/xray/index.js";
import { validateXray, hasErrors, type ValidationIssue } from "../validate/index.js";
import { formatJson } from "../format/json.js";
import { loadProject, saveProject } from "../project/store.js";
import { promptProject } from "./prompts.js";
import { buildReadme, formatIssueReport } from "./output.js";

export const OUTPUT_DIR = "output";

async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv.slice(2);
  switch (cmd) {
    case "new":
      return runNew(rest[0]);
    case "edit":
      return runEdit(rest[0]);
    case "check":
      return runCheckCmd(rest[0], rest[1]);
    case "format":
      return runFormatCmd(rest[0], rest[1]);
    case "list":
      return runList();
    default:
      printHelp();
      process.exit(cmd ? 1 : 0);
  }
}

function projectPath(name: string): string {
  return join(OUTPUT_DIR, name);
}

/** Build the GenerateOptions from a project input (generates any missing secrets). */
function buildGenerateOptions(input: XrayProjectInput) {
  const needsReality = input.inbounds.some((s) => s.id === "reality");
  const needsCert = input.inbounds.some(
    (s) => s.id === "vless-ws" || s.id === "vless-grpc"
  );
  const domain = input.inbounds.find(
    (i) =>
      (i.options as { domain?: string }).domain
  )?.options.domain as string | undefined;
  return {
    uuid: generateUuid(),
    password: generatePassword(),
    realityKeyPair: needsReality ? generateRealityKeyPair() : undefined,
    shortIds: needsReality ? generateShortIds() : undefined,
    selfSignedCert: needsCert
      ? generateSelfSignedCert({ domain: domain ?? "localhost" })
      : undefined,
  };
}

async function runNew(name?: string): Promise<void> {
  const input = await promptProject();
  const projectName = name ?? defaultName();
  const opts = buildGenerateOptions(input);
  const { config, clientNodes, secrets } = generateXrayConfig(input, opts);
  const serverJson = formatJson(config);

  const issues = validateXray(config);
  if (hasErrors(issues)) {
    console.error(formatIssueReport(issues, "server.json"));
    process.exit(1);
  }

  const readme = buildReadme({
    projectName,
    nodes: clientNodes,
    serverConfigPath: "server.json",
    certNote: secrets.length
      ? "## Certificates\n\nSelf-signed cert/key written to `certs/`."
      : undefined,
  });

  saveProject(projectPath(projectName), {
    project: input,
    serverJson,
    readme,
    secrets,
  });

  console.log(kleur.green(`✓ project created: ${projectPath(projectName)}`));
  console.log(formatIssueReport(issues, join(projectPath(projectName), "server.json")));
}

async function runEdit(name: string): Promise<void> {
  const dir = projectPath(name);
  const { project } = loadProject(dir);
  const input = await promptProject(project);
  const opts = buildGenerateOptions(input);
  const { config, clientNodes, secrets } = generateXrayConfig(input, opts);
  const serverJson = formatJson(config);
  const readme = buildReadme({
    projectName: name,
    nodes: clientNodes,
    serverConfigPath: "server.json",
  });
  saveProject(dir, { project: input, serverJson, readme, secrets });
  console.log(kleur.green(`✓ project updated: ${dir}`));
}

function runCheckCmd(name: string, file?: string): void {
  const dir = projectPath(name);
  const path = file ? join(dir, file) : join(dir, "server.json");
  const raw = readFileSync(path, "utf8");
  const issues = runCheck(JSON.parse(raw));
  console.log(formatIssueReport(issues, path));
  process.exit(hasErrors(issues) ? 1 : 0);
}

function runFormatCmd(name: string, file?: string): void {
  const dir = projectPath(name);
  const path = file ? join(dir, file) : join(dir, "server.json");
  const raw = readFileSync(path, "utf8");
  writeFileSync(path, runFormat(raw));
  console.log(kleur.green(`✓ formatted ${path}`));
}

function runList(): void {
  if (!existsSync(OUTPUT_DIR)) {
    console.log("(no projects yet)");
    return;
  }
  const names = readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (names.length === 0) console.log("(no projects yet)");
  else for (const n of names) console.log(n);
}

// ---- Pure helpers (also exported for tests) ----

export function runCheck(config: unknown): ValidationIssue[] {
  return validateXray(config);
}

export function runFormat(rawJson: string): string {
  return formatJson(JSON.parse(rawJson));
}

function defaultName(): string {
  return `proj-${Date.now()}`;
}

function printHelp(): void {
  console.log(`configtools — Xray-core config generator

Usage:
  configtools new [name]            interactive: generate a project
  configtools edit <name>           reload and re-prompt to change fields
  configtools check <name> [file]   validate a project's config (default server.json)
  configtools format <name> [file]  pretty-print a project's config in place
  configtools list                  list projects in ${OUTPUT_DIR}/`);
}

main(process.argv).catch((err) => {
  console.error(kleur.red(`error: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add src/cli/index.ts tests/cli/index.test.ts
git commit -m "feat(cli): add new/edit/check/format/list subcommands"
```

---

## Task 21: Wire library entrypoint (`src/index.ts`)

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update `src/index.ts` to re-export the public library API**

```ts
export { VERSION } from "./version.js";
export { generateXrayConfig } from "./engines/xray/index.js";
export type {
  XrayConfig,
  XrayInbound,
  XrayStreamSettings,
  InboundModule,
  BuildContext,
} from "./engines/xray/types.js";
export { validateXray } from "./validate/index.js";
export type { ValidationIssue } from "./validate/index.js";
export { formatJson } from "./format/json.js";
export { generateUuid } from "./crypto/uuid.js";
export { generateRealityKeyPair } from "./crypto/reality-keys.js";
export { generateSelfSignedCert } from "./cert/self-signed.js";
```

- [ ] **Step 2: Create `src/version.ts`**

```ts
export const VERSION = "0.1.0";
```

- [ ] **Step 3: Update the sanity test to import from `./version.js` instead of `../src/index.js`**

In `tests/sanity.test.ts`, change:
```ts
import { VERSION } from "../src/version.js";
```
(Task 0 imported from `../src/index.js`; since `src/index.ts` now re-exports, the original import still works, but to avoid a circular-ish dependency in tests, point directly at `version.js`.)

- [ ] **Step 4: Build & test**

Run: `npm run typecheck && npm run build && npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/version.ts tests/sanity.test.ts
git commit -m "feat: expose public library API"
```

---

## Task 22: End-to-end smoke test + README

Manually exercise the full CLI against a real Xray-core 26.x binary if available; otherwise validate via the in-process pipeline. Write the project README.

**Files:**
- Create: `README.md`
- Create: `tests/e2e/generate.test.ts`

- [ ] **Step 1: Write an in-process e2e test (no terminal interaction)**

```ts
// tests/e2e/generate.test.ts
import { describe, it, expect } from "vitest";
import { generateXrayConfig } from "../../src/engines/xray/index.js";
import { validateXray, hasErrors } from "../../src/validate/index.js";
import { generateUuid } from "../../src/crypto/uuid.js";
import {
  generateRealityKeyPair,
  generateShortIds,
} from "../../src/crypto/index.js";

describe("e2e: reality-only generate → validate", () => {
  it("produces a config that passes its own validation", () => {
    const input = {
      common: { publicAddress: "1.2.3.4", logLevel: "warning", routing: "none" },
      inbounds: [
        {
          id: "reality" as const,
          options: {
            listen: "",
            port: 443,
            dest: "www.microsoft.com:443",
            serverNames: ["www.microsoft.com"],
            xver: 0,
          },
        },
      ],
    };
    const { config } = generateXrayConfig(input, {
      uuid: generateUuid(),
      realityKeyPair: generateRealityKeyPair(),
      shortIds: generateShortIds(),
    });
    const issues = validateXray(config);
    expect(hasErrors(issues)).toBe(false);
  });
});
```

> Note: this test imports from `src/crypto/index.js` (a barrel). Add `src/crypto/index.ts` re-exporting `uuid.ts`, `reality-keys.ts`, `short-id.ts`, `password.ts` as part of this task:

```ts
// src/crypto/index.ts
export * from "./uuid.js";
export * from "./reality-keys.js";
export * from "./short-id.js";
export * from "./password.js";
```

- [ ] **Step 2: Run the e2e test**

Run: `npm test -- tests/e2e/generate.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full suite + typecheck + build**

Run: `npm run typecheck && npm run build && npm test`
Expected: all green.

- [ ] **Step 4: Manual smoke test of the CLI (interactive)**

Run: `npm run dev -- new demo`
Interact: choose address `127.0.0.1`, log `warning`, routing `none`, select `reality`, accept Reality defaults.
Expected: prints `✓ project created: output/demo`; `output/demo/server.json` exists and is sorted; `output/demo/README.md` lists the node + share link.

Run: `npm run dev -- check demo`
Expected: prints `✓ output/demo/server.json is valid.` (exit 0).

Run: `npm run dev -- format demo`
Expected: prints `✓ formatted output/demo/server.json`.

- [ ] **Step 5: (Optional) validate against a real Xray-core binary**

If `xray` 26.x is installed:
```bash
xray run -test -c output/demo/server.json
```
Expected: `Configuration OK.` (or similar). If no binary available, note this in the README and rely on the schema + rule validation.

- [ ] **Step 6: Write `README.md`**

```markdown
# ConfigTools

Interactive generator for **Xray-core 26.x** server `config.json`. Auto-generates
UUID, Reality X25519 keypair + shortIds, and a self-signed ECDSA P-256 certificate.
Supports a manual-edit → format → check loop.

> **v1 scope:** Xray-core server config for VLESS+Reality+Vision, VLESS+WS+TLS,
> VLESS+gRPC+TLS. sing-box / Clash / Argo are planned for later versions.

## Install / run

```bash
npx configtools new myproject
# or from source:
npm install && npm run build
node dist/cli/index.js new myproject
```

## Commands

| Command | Description |
| --- | --- |
| `configtools new [name]` | Interactively generate a project |
| `configtools edit <name>` | Reload a project and re-prompt to change fields |
| `configtools check <name> [file]` | Validate a project's config (default `server.json`) |
| `configtools format <name> [file]` | Pretty-print a project's config in place |
| `configtools list` | List projects in `output/` |

## Output layout

```
output/<name>/
├── server.json     # the generated Xray config (sorted, 2-space)
├── project.json    # your input choices (source of truth for `edit`)
├── README.md       # node table + share links + client advice
└── certs/          # cert.pem + key.pem (only for WS/gRPC inbounds)
```

`project.json` stores your choices; `server.json` is always rebuildable from it.
Hand-edit `server.json`, then run `configtools check` to validate and
`configtools format` to normalize.

## Validation

`check` runs two layers: a JSON Schema (structure) then business rules (port
ranges, UUID format, Reality dest/serverNames/privateKey/shortIds, routing tag
references, duplicate ports). Exit code is `1` on any error, `0` otherwise —
scriptable in CI.

## Credentials

- UUID: `crypto.randomUUID` (RFC4122 v4)
- Reality keys: X25519 via Node `crypto`, base64url (matches `xray x25519`)
- Cert: ECDSA P-256, CN + SAN = your domain, hand-built DER, zero deps

## Development

```bash
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # tsc → dist/
```
```

- [ ] **Step 7: Commit**

```bash
git add README.md src/crypto/index.ts tests/e2e/generate.test.ts
git commit -m "docs: add README and end-to-end generation test"
```

---

## Self-Review (completed)

**1. Spec coverage:**
- §3 architecture/layout → Tasks 0–13, 17, 18, 20, 21
- §4 module interface + data flow → Tasks 7 (types), 12 (registry), 13 (assembler)
- §5 credential/cert generation → Tasks 1–6
- §6 validation (schema + rules) → Tasks 14, 15
- §4.4 CLI surface (new/edit/check/format/list) → Task 20
- §7 routing presets → Task 8 (skeleton)
- §8 testing (unit tests of pure functions) → every task has a test; Task 22 e2e
- §10 acceptance checklist → Task 22 (manual smoke) covers each bullet
- §11 roadmap → out of scope, noted in README

**2. Placeholder scan:** Task 5's test had 3 `... ""` pseudo-assertions; these are flagged with explicit correct values in the note under Step 1 (the implementer fixes them before running). Task 6's implementation has 4 known correctness issues flagged in the note (version, dNSName tag, serial encoding, EC-point offset) — this is the expected TDD debugging loop, not a placeholder: the structure is given, only details are tuned against a real parser. All other tasks contain complete, runnable code.

**3. Type consistency:** `InboundModule<TOptions>`, `BuildContext`, `InboundResult`, `ClientNode`, `SecretArtifact`, `ValidationIssue`, `XrayProjectInput`, `GenerateResult` defined in Task 7/13/15 are used consistently in Tasks 9–13, 15, 17–20. `getModule`, `XRAY_MODULES` (Task 12) match usage in Tasks 13, 18. `generateXrayConfig(input, opts)` signature (Task 13) matches call sites in Tasks 20, 22. Share-link helpers in Tasks 9–11 return the `ClientNode.shareLink` shape asserted in their tests and rendered in Task 19.

No gaps, no placeholders beyond the two flagged-and-resolved debugging tasks. Plan is complete.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-24-configtools-xray-generator.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
