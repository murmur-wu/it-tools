export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'PS384' | 'PS512' | 'ES256' | 'ES384' | 'ES512';

export const jwtAlgorithms: JwtAlgorithm[] = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];

export function isSymmetric(algorithm: JwtAlgorithm): boolean {
  return algorithm.startsWith('HS');
}

const hashes: Record<string, string> = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
const curves: Record<string, string> = { ES256: 'P-256', ES384: 'P-384', ES512: 'P-521' };

const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlEncode(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? bytes : Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

function decodeJson(segment: string): unknown {
  return JSON.parse(decoder.decode(base64UrlDecode(segment)));
}

function pemToDer(pem: string, expectedLabel: RegExp): { der: Uint8Array; label: string } {
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(pem);
  if (!match) {
    throw new Error('Key must be in PEM format (-----BEGIN ... KEY-----)');
  }
  const [, label, body] = match;
  if (!expectedLabel.test(label)) {
    throw new Error(`Unexpected PEM block "${label}"`);
  }
  const binary = atob(body.replace(/\s+/g, ''));
  return { der: Uint8Array.from(binary, char => char.charCodeAt(0)), label };
}

function algorithmParams(algorithm: JwtAlgorithm): { importParams: RsaHashedImportParams | EcKeyImportParams; signParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams } {
  const hash = hashes[algorithm.slice(2)];
  if (algorithm.startsWith('RS')) {
    return { importParams: { name: 'RSASSA-PKCS1-v1_5', hash }, signParams: { name: 'RSASSA-PKCS1-v1_5' } };
  }
  if (algorithm.startsWith('PS')) {
    return { importParams: { name: 'RSA-PSS', hash }, signParams: { name: 'RSA-PSS', saltLength: Number(algorithm.slice(2)) / 8 } };
  }
  return { importParams: { name: 'ECDSA', namedCurve: curves[algorithm] }, signParams: { name: 'ECDSA', hash } };
}

async function importSecret(algorithm: JwtAlgorithm, secret: string, secretEncoding: 'utf8' | 'base64url', usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const bytes = secretEncoding === 'base64url' ? base64UrlDecode(secret) : encoder.encode(secret);
  if (bytes.length === 0) {
    throw new Error('Secret must not be empty');
  }
  return subtle().importKey('raw', bytes, { name: 'HMAC', hash: hashes[algorithm.slice(2)] }, false, [usage]);
}

async function importPrivateKey(algorithm: JwtAlgorithm, pem: string): Promise<CryptoKey> {
  const { der, label } = pemToDer(pem, /PRIVATE KEY$/);
  if (label !== 'PRIVATE KEY') {
    throw new Error(`"${label}" is not supported. Convert it to PKCS#8 first: openssl pkcs8 -topk8 -nocrypt -in key.pem`);
  }
  const { importParams } = algorithmParams(algorithm);
  try {
    return await subtle().importKey('pkcs8', der, importParams, true, ['sign']);
  }
  catch {
    throw new Error(`The private key does not match ${algorithm} (expected ${importParams.name}${'namedCurve' in importParams ? ` on ${importParams.namedCurve}` : ''})`);
  }
}

async function importPublicKey(algorithm: JwtAlgorithm, pem: string): Promise<CryptoKey> {
  const { importParams } = algorithmParams(algorithm);
  const { der, label } = pemToDer(pem, /(PUBLIC|PRIVATE) KEY$|CERTIFICATE$/);

  try {
    if (label === 'PUBLIC KEY') {
      return await subtle().importKey('spki', der, importParams, true, ['verify']);
    }
    if (label === 'PRIVATE KEY') {
      // Derive the public key from a PKCS#8 private key through its JWK form
      const privateKey = await subtle().importKey('pkcs8', der, importParams, true, ['sign']);
      const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, key_ops: _ops, ...publicJwk } = await subtle().exportKey('jwk', privateKey);
      return await subtle().importKey('jwk', publicJwk, importParams, true, ['verify']);
    }
  }
  catch {
    throw new Error(`The key does not match ${algorithm} (expected ${importParams.name}${'namedCurve' in importParams ? ` on ${importParams.namedCurve}` : ''})`);
  }
  throw new Error('Use a PEM public key (-----BEGIN PUBLIC KEY-----) or a PKCS#8 private key');
}

export interface KeyMaterial {
  secret?: string
  secretEncoding?: 'utf8' | 'base64url'
  privateKeyPem?: string
  publicKeyPem?: string
}

export async function signJwt({ header, payload, algorithm, key }: { header: Record<string, unknown>; payload: unknown; algorithm: JwtAlgorithm; key: KeyMaterial }): Promise<string> {
  const fullHeader = { ...header, alg: algorithm, typ: header.typ ?? 'JWT' };
  const signingInput = `${encodeJson(fullHeader)}.${encodeJson(payload)}`;
  const data = encoder.encode(signingInput);

  let signature: ArrayBuffer;
  if (isSymmetric(algorithm)) {
    const cryptoKey = await importSecret(algorithm, key.secret ?? '', key.secretEncoding ?? 'utf8', 'sign');
    signature = await subtle().sign('HMAC', cryptoKey, data);
  }
  else {
    const cryptoKey = await importPrivateKey(algorithm, key.privateKeyPem ?? '');
    signature = await subtle().sign(algorithmParams(algorithm).signParams, cryptoKey, data);
  }

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export interface VerifyResult {
  valid: boolean
  header: Record<string, unknown>
  payload: unknown
  algorithm: string
  reason?: string
}

export async function verifyJwt({ token, key, algorithm: forcedAlgorithm }: { token: string; key: KeyMaterial; algorithm?: JwtAlgorithm }): Promise<VerifyResult> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('A JWT must have three dot-separated parts');
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: Record<string, unknown>;
  let payload: unknown;
  try {
    header = decodeJson(headerSegment) as Record<string, unknown>;
    payload = decodeJson(payloadSegment);
  }
  catch {
    throw new Error('Header or payload is not valid base64url-encoded JSON');
  }

  const algorithm = (forcedAlgorithm ?? header.alg) as JwtAlgorithm;
  if (!jwtAlgorithms.includes(algorithm)) {
    return { valid: false, header, payload, algorithm: String(header.alg), reason: `Unsupported algorithm "${String(header.alg)}"` };
  }
  if (forcedAlgorithm && header.alg !== forcedAlgorithm) {
    return { valid: false, header, payload, algorithm, reason: `Token header says ${String(header.alg)} but ${forcedAlgorithm} was expected` };
  }

  const data = encoder.encode(`${headerSegment}.${payloadSegment}`);
  const signature = base64UrlDecode(signatureSegment);

  let valid: boolean;
  if (isSymmetric(algorithm)) {
    const cryptoKey = await importSecret(algorithm, key.secret ?? '', key.secretEncoding ?? 'utf8', 'verify');
    valid = await subtle().verify('HMAC', cryptoKey, signature, data);
  }
  else {
    const cryptoKey = await importPublicKey(algorithm, key.publicKeyPem ?? key.privateKeyPem ?? '');
    valid = await subtle().verify(algorithmParams(algorithm).signParams, cryptoKey, signature, data);
  }

  return { valid, header, payload, algorithm, reason: valid ? undefined : 'Signature does not match' };
}

export async function generateKeyPairPem(algorithm: JwtAlgorithm): Promise<{ privateKeyPem: string; publicKeyPem: string }> {
  if (isSymmetric(algorithm)) {
    throw new Error('HMAC algorithms use a shared secret, not a key pair');
  }
  const { importParams } = algorithmParams(algorithm);
  const generateParams = 'namedCurve' in importParams
    ? importParams
    : { ...importParams, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
  const keyPair = await subtle().generateKey(generateParams, true, ['sign', 'verify']) as CryptoKeyPair;

  const toPem = (der: ArrayBuffer, label: string) => {
    const base64 = btoa(Array.from(new Uint8Array(der), byte => String.fromCharCode(byte)).join(''));
    return `-----BEGIN ${label}-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END ${label}-----`;
  };

  return {
    privateKeyPem: toPem(await subtle().exportKey('pkcs8', keyPair.privateKey), 'PRIVATE KEY'),
    publicKeyPem: toPem(await subtle().exportKey('spki', keyPair.publicKey), 'PUBLIC KEY'),
  };
}
