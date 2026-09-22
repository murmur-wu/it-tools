import { describe, expect, it } from 'vitest';
import { parseCertificates } from './certificate-parser.service';
import { ecCertificatePem, rsaCertificatePem } from './certificate-parser.fixtures';

describe('certificate parser', () => {
  it('parses an RSA certificate', () => {
    const [cert] = parseCertificates(rsaCertificatePem);
    expect(cert.version).toBe(3);
    expect(cert.subjectString).toBe('CN=rsa.example.com');
    expect(cert.isSelfSigned).toBe(true);
    expect(cert.publicKey).toEqual({ algorithm: 'RSA', size: 2048 });
    expect(cert.signatureAlgorithm).toBe('SHA-256 with RSA');
    expect(cert.notAfter.getTime()).toBeGreaterThan(cert.notBefore.getTime());
    expect(cert.serialNumber).toMatch(/^[0-9A-F]+$/);
    expect(cert.fingerprints.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(cert.fingerprints.sha1).toMatch(/^([0-9A-F]{2}:){19}[0-9A-F]{2}$/);
    expect(cert.isCa).toBe(true);
    expect(cert.subjectKeyIdentifier).toMatch(/^([0-9A-F]{2}:){19}[0-9A-F]{2}$/);
  });

  it('parses an EC certificate with subject alternative names', () => {
    const [cert] = parseCertificates(ecCertificatePem);
    expect(cert.subject).toEqual([
      { shortName: 'CN', name: 'commonName', value: 'ec.example.com' },
      { shortName: 'O', name: 'organizationName', value: 'EC Org' },
    ]);
    expect(cert.publicKey).toEqual({ algorithm: 'EC', curve: 'P-256 (prime256v1)', size: 256 });
    expect(cert.signatureAlgorithm).toBe('ECDSA with SHA-256');
    expect(cert.subjectAltNames).toEqual(['DNS:ec.example.com', 'IP:192.168.1.1']);
  });

  it('computes the validity status relative to a reference date', () => {
    const [cert] = parseCertificates(rsaCertificatePem);
    expect(parseCertificates(rsaCertificatePem, { now: new Date(cert.notBefore.getTime() + 1000) })[0].status).toBe('valid');
    expect(parseCertificates(rsaCertificatePem, { now: new Date(cert.notBefore.getTime() - 86_400_000) })[0].status).toBe('not-yet-valid');
    const expired = parseCertificates(rsaCertificatePem, { now: new Date(cert.notAfter.getTime() + 86_400_000) })[0];
    expect(expired.status).toBe('expired');
    expect(expired.daysRemaining).toBeLessThan(0);
  });

  it('parses several PEM blocks (a chain) in one input', () => {
    const certs = parseCertificates(`${rsaCertificatePem}\n${ecCertificatePem}`);
    expect(certs.map(cert => cert.subjectString)).toEqual(['CN=rsa.example.com', 'CN=ec.example.com, O=EC Org']);
  });

  it('accepts bare base64 DER without PEM armour', () => {
    const base64 = rsaCertificatePem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    expect(parseCertificates(base64)[0].subjectString).toBe('CN=rsa.example.com');
  });

  it('rejects input without a certificate', () => {
    expect(() => parseCertificates('')).toThrow('No certificate found');
    expect(() => parseCertificates('hello world')).toThrow('No certificate found');
    expect(() => parseCertificates('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----')).toThrow('Unable to parse certificate');
  });
});
