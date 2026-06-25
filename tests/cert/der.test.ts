import { describe, it, expect } from "vitest";
import {
  derLength,
  derInteger,
  derIntegerBytes,
  derOid,
  derSequence,
  derSet,
  derBitString,
  derOctetString,
  derUtf8String,
  derPrintableString,
  derIa5String,
  derUtcTime,
  derContextTag,
  toUint8Array,
} from "../../src/cert/der.js";

// Helper: byte array -> hex string
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
    expect(hex(derInteger(0x010203))).toBe("0203010203");
  });

  it("derIntegerBytes adds leading 0 when high bit set", () => {
    expect(hex(derIntegerBytes([0x7f]))).toBe("02017f"); // no leading 0
    expect(hex(derIntegerBytes([0xff]))).toBe("020200ff"); // leading 0 added
    expect(hex(derIntegerBytes([0x01, 0x02]))).toBe("02020102");
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
    expect(hex(derSequence([]))).toBe("3000"); // empty sequence
  });

  it("derBitString wraps with unused-bits prefix 0x00", () => {
    expect(hex(derBitString([0x04, 0x10]))).toBe("0303000410");
  });

  it("derOctetString", () => {
    expect(hex(derOctetString([0xde, 0xad]))).toBe("0402dead");
  });

  it("derUtf8String / derPrintableString / derIa5String", () => {
    expect(hex(derPrintableString("example.com"))).toBe(
      "130b" + Buffer.from("example.com").toString("hex")
    );
    expect(hex(derUtf8String("a"))).toBe("0c0161");
    // IA5String uses tag 0x16
    expect(hex(derIa5String("example.com"))).toBe(
      "160b" + Buffer.from("example.com").toString("hex")
    );
  });

  it("derUtcTime (YYMMDDHHMMSSZ)", () => {
    const d = new Date(Date.UTC(2026, 5, 24, 10, 30, 0)); // 2026-06-24
    // tag 0x17, length 0x0d (13 bytes), value "260624103000Z"
    expect(derUtcTime(d).slice(0, 2)).toEqual([0x17, 0x0d]);
    expect(
      derUtcTime(d)
        .slice(2)
        .map((b) => String.fromCharCode(b))
        .join("")
    ).toBe("260624103000Z");
    expect(hex(derUtcTime(d))).toBe(
      "170d" + Buffer.from("260624103000Z", "ascii").toString("hex")
    );
  });

  it("derContextTag constructs [n] EXPLICIT wrapper", () => {
    // [0] wrapping an empty sequence: a0 02 30 00
    expect(hex(derContextTag(0, derSequence([])))).toBe("a0023000");
    // [3] wrapping one byte 0xff: a3 01 ff
    expect(hex(derContextTag(3, [0xff]))).toBe("a301ff");
  });

  it("toUint8Array converts", () => {
    expect(toUint8Array([0x01, 0x02])).toEqual(new Uint8Array([1, 2]));
  });
});
