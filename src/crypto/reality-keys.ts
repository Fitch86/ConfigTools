import { generateKeyPairSync } from "node:crypto";

// X25519 DER encoding constants (RFC 8410):
//   PKCS8 OneAsymmetricKey: 302e 020100 300506032b656e 0422 0420 <32 raw bytes>  (16-byte prefix)
//   SPKI SubjectPublicKey:  302a 300506032b656e 032100 <32 raw bytes>            (12-byte prefix)
const PKCS8_PREFIX_LEN = 16;
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

  const privDer = privateKey as Buffer;
  const pubDer = publicKey as Buffer;
  const privRaw = privDer.subarray(
    PKCS8_PREFIX_LEN,
    PKCS8_PREFIX_LEN + RAW_LEN
  );
  const pubRaw = pubDer.subarray(SPKI_PREFIX_LEN, SPKI_PREFIX_LEN + RAW_LEN);

  return {
    privateKey: Buffer.from(privRaw).toString("base64url"),
    publicKey: Buffer.from(pubRaw).toString("base64url"),
  };
}
