import { describe, it, expect } from "vitest";
import { X509Certificate, createPublicKey } from "node:crypto";import { generateSelfSignedCert } from "../../src/cert/self-signed.js";

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
    expect(cert.subjectAltName).toContain("DNS:my.proxy.tld");
    expect(cert.subjectAltName).toBeDefined();
  });

  it("cert's public key matches the private key", () => {
    const { certPem, keyPem } = generateSelfSignedCert({
      domain: "example.com",
    });
    const cert = new X509Certificate(certPem);
    const fromCert = cert.publicKey.export({
      type: "spki",
      format: "der",
    });
    const fromKey = createPublicKey(keyPem).export({
      type: "spki",
      format: "der",
    });
    expect(Buffer.from(fromCert as ArrayBuffer)).toEqual(Buffer.from(fromKey as ArrayBuffer));
  });

  it("uses ECDSA P-256", () => {
    const { certPem } = generateSelfSignedCert({ domain: "example.com" });
    const cert = new X509Certificate(certPem);
    expect(cert.publicKey.asymmetricKeyType).toBe("ec");
    expect(
      /P-256|prime256v1|secp256r1/i.test(
        (cert.publicKey as unknown as { asymmetricKeyDetails?: { namedCurve?: string } })
          .asymmetricKeyDetails?.namedCurve ?? ""
      )
    ).toBe(true);
  });

  it("issuer == subject (self-signed)", () => {
    const { certPem } = generateSelfSignedCert({ domain: "example.com" });
    const cert = new X509Certificate(certPem);
    expect(cert.issuer).toBe(cert.subject);
  });
});
