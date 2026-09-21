import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, generateKeyPairPem, signJwt, verifyJwt } from './jwt-signer.service';

const header = { typ: 'JWT' };
const payload = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };

describe('jwt signer', () => {
  it('base64url round-trips', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
    expect(base64UrlEncode(bytes)).not.toMatch(/[+/=]/);
  });

  it('produces the well-known jwt.io HS256 example token', async () => {
    const token = await signJwt({ header: { alg: 'HS256', typ: 'JWT' }, payload, algorithm: 'HS256', key: { secret: 'your-256-bit-secret' } });
    expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('verifies HMAC tokens and rejects a wrong secret or a tampered payload', async () => {
    const token = await signJwt({ header, payload, algorithm: 'HS512', key: { secret: 'top secret' } });
    expect((await verifyJwt({ token, key: { secret: 'top secret' } })).valid).toBe(true);
    expect((await verifyJwt({ token, key: { secret: 'wrong' } })).valid).toBe(false);

    const [h, , s] = token.split('.');
    const tampered = `${h}.${base64UrlEncode(new TextEncoder().encode(JSON.stringify({ ...payload, name: 'Mallory' })))}.${s}`;
    const result = await verifyJwt({ token: tampered, key: { secret: 'top secret' } });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Signature does not match');
  });

  it('accepts a base64url-encoded secret', async () => {
    const token = await signJwt({ header, payload, algorithm: 'HS256', key: { secret: 'AAECAwQFBgc', secretEncoding: 'base64url' } });
    expect((await verifyJwt({ token, key: { secret: 'AAECAwQFBgc', secretEncoding: 'base64url' } })).valid).toBe(true);
    expect((await verifyJwt({ token, key: { secret: 'AAECAwQFBgc', secretEncoding: 'utf8' } })).valid).toBe(false);
  });

  it.each(['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'] as const)('signs and verifies with %s using a generated key pair', async (algorithm) => {
    const { privateKeyPem, publicKeyPem } = await generateKeyPairPem(algorithm);
    expect(privateKeyPem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(publicKeyPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);

    const token = await signJwt({ header, payload, algorithm, key: { privateKeyPem } });
    expect(token.split('.')).toHaveLength(3);

    expect((await verifyJwt({ token, key: { publicKeyPem } })).valid).toBe(true);
    // the public key can also be derived from the private key
    expect((await verifyJwt({ token, key: { privateKeyPem } })).valid).toBe(true);

    const other = await generateKeyPairPem(algorithm);
    expect((await verifyJwt({ token, key: { publicKeyPem: other.publicKeyPem } })).valid).toBe(false);
  }, 20_000);

  it('reports header, payload and useful errors', async () => {
    const token = await signJwt({ header, payload, algorithm: 'HS256', key: { secret: 's' } });
    const result = await verifyJwt({ token, key: { secret: 's' } });
    expect(result.header).toEqual({ typ: 'JWT', alg: 'HS256' });
    expect(result.payload).toEqual(payload);
    expect(result.algorithm).toBe('HS256');

    expect((await verifyJwt({ token, key: { secret: 's' }, algorithm: 'HS384' })).reason).toContain('HS384 was expected');
    await expect(verifyJwt({ token: 'a.b', key: { secret: 's' } })).rejects.toThrow('three dot-separated parts');
    await expect(signJwt({ header, payload, algorithm: 'HS256', key: { secret: '' } })).rejects.toThrow('Secret must not be empty');
    await expect(signJwt({ header, payload, algorithm: 'RS256', key: { privateKeyPem: 'not a pem' } })).rejects.toThrow('PEM format');
    const { privateKeyPem } = await generateKeyPairPem('ES256');
    await expect(signJwt({ header, payload, algorithm: 'RS256', key: { privateKeyPem } })).rejects.toThrow('does not match RS256');
  }, 20_000);
});
