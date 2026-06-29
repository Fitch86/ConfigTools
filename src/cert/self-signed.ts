import {
  generateKeyPairSync,
  createSign,
  randomBytes,
} from "node:crypto";
import {
  derSequence,
  derSet,
  derInteger,
  derIntegerBytes,
  derOid,
  derBitString,
  derContextTag,
  derPrimitiveContextTag,
  derUtf8String,
  derOctetString,
  derUtcTime,
  toUint8Array,
} from "./der.js";

// OIDs
const OID_EC_PUBLIC_KEY = [1, 2, 840, 10045, 2, 1]; // id-ecPublicKey
const OID_PRIME256V1 = [1, 2, 840, 10045, 3, 1, 7]; // prime256v1 (P-256)
const OID_ECDSA_SHA256 = [1, 2, 840, 10045, 4, 3, 2]; // ecdsa-with-SHA256
const OID_COMMON_NAME = [2, 5, 4, 3]; // commonName
const OID_SUBJECT_ALT_NAME = [2, 5, 29, 17]; // subjectAltName

// P-256 SPKI: SEQ{ AlgId, BITSTRING{unused(1) + ECpoint(65)} } = 91 bytes.
// EC point (0x04 || X || Y) begins at DER offset 26.
const EC_POINT_OFFSET = 26;

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
    publicKeyEncoding: { type: "spki", format: "der" },
  });
  const pubSpki = publicKey as Buffer;

  // Extract the EC point (0x04 || X || Y, 65 bytes) from the SPKI.
  const ecPoint = [...pubSpki.subarray(EC_POINT_OFFSET)];
  if (ecPoint[0] !== 0x04) {
    throw new Error("expected uncompressed EC point (0x04 prefix)");
  }

  const notBefore = new Date();
  notBefore.setMinutes(notBefore.getMinutes() - 5); // 5 min clock-skew tolerance
  const notAfter = new Date(notBefore.getTime() + days * 86400_000);

  const serial = randomBytes(16);
  serial[0] &= 0x7f; // ensure positive (clear high bit)

  // Subject / Issuer (identical, self-signed): CN=domain
  // Use UTF8String (tag 0x0c) per RFC 5280 §8 / CABR for v3 certs.
  // OpenSSL 3.x rejects PrintableString in v3 DirectoryNames.
  const rdn = derSequence(
    derSet(derSequence([derOid(OID_COMMON_NAME), derUtf8String(domain)]))
  );

  // SubjectPublicKeyInfo: SEQ{ AlgorithmIdentifier, BIT STRING{EC point} }
  const algorithm = derSequence([
    derOid(OID_EC_PUBLIC_KEY),
    derOid(OID_PRIME256V1),
  ]);
  const subjectPublicKeyInfo = derSequence([
    algorithm,
    derBitString(ecPoint),
  ]);

  // subjectAltName extension: SEQUENCE of GeneralName. dNSName is [2] IMPLICIT
  // IA5String — an IMPLICIT tag replaces the IA5 tag with a PRIMITIVE context
  // tag [2] (0x82) carrying the ASCII bytes directly (no inner wrapper, no
  // constructed bit). The whole GeneralNames SEQUENCE is wrapped in an OCTET
  // STRING as the extension value.
  const subjectAltName = derSequence(
    derPrimitiveContextTag(2, [...Buffer.from(domain, "ascii")])
  );
  const sanExtension = derSequence([
    derOid(OID_SUBJECT_ALT_NAME),
    derOctetString(subjectAltName),
  ]);
  const extensions = derContextTag(3, derSequence([sanExtension]));

  // TBSCertificate (version v3 = 2)
  const tbs = derSequence([
    derContextTag(0, derInteger(2)), // version v3
    derIntegerBytes(serial), // serialNumber
    derSequence([derOid(OID_ECDSA_SHA256)]), // signature algorithm
    rdn, // issuer
    derSequence([derUtcTime(notBefore), derUtcTime(notAfter)]), // validity
    rdn, // subject
    subjectPublicKeyInfo, // subjectPublicKey
    extensions, // [3] EXPLICIT extensions
  ]);

  // Sign TBSCertificate with the private key (ECDSA-SHA256). sign() returns the
  // DER-encoded ECDSA-Sig-Value (SEQ{ r, s }) directly.
  const signer = createSign("SHA256");
  signer.update(Buffer.from(toUint8Array(tbs)));
  const signatureDer = signer.sign(privateKey);

  // Certificate = SEQ{ TBSCertificate, signatureAlgorithm, BIT STRING{signature} }
  const cert = derSequence([
    tbs,
    derSequence([derOid(OID_ECDSA_SHA256)]),
    derBitString([...signatureDer]),
  ]);

  const certPem = toPem(Buffer.from(toUint8Array(cert)), "CERTIFICATE");

  return { certPem, keyPem: privateKey as string };
}

function toPem(der: Buffer, label: string): string {
  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}
