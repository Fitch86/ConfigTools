import { describe, it, expect } from "vitest";
import { createPrivateKey, createPublicKey } from "node:crypto";
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
    const pkcs8Prefix = Buffer.from("302e020100300506032b656e04220420", "hex");
    const der = Buffer.concat([pkcs8Prefix, privRaw]);
    expect(der).toHaveLength(PRIV_DER_LEN);
    const keyObj = createPrivateKey({
      key: der,
      format: "der",
      type: "pkcs8",
    });
    // Derive the public key from the private, then export as SPKI.
    const spki = createPublicKey(keyObj).export({
      type: "spki",
      format: "der",
    }) as Buffer;
    expect(spki).toHaveLength(PUB_DER_LEN);
    const derivedRaw = spki.subarray(12, 44);
    expect(Buffer.from(derivedRaw).toString("base64url")).toBe(pubB64);
  });
});
