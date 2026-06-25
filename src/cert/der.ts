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

/** DER INTEGER from raw unsigned bytes (adds leading 0 if high bit set). */
export function derIntegerBytes(bytes: number[] | Uint8Array): number[] {
  const content = Array.from(bytes);
  if (content.length === 0) return wrap(0x02, [0x00]);
  if (content[0] & 0x80) content.unshift(0x00);
  return wrap(0x02, content);
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
  return wrap(0x30, flatten(content));
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

/** DER IA5String (ASCII), tag 0x16. Used for dNSName in subjectAltName. */
export function derIa5String(s: string): number[] {
  return wrap(0x16, [...Buffer.from(s, "ascii")]);
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
