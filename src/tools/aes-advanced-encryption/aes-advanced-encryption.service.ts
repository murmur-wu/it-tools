import { AES, mode as cryptoJsMode, lib, pad } from 'crypto-js';

export type AesMode = 'CBC' | 'GCM' | 'CTR' | 'ECB';
export type BytesEncoding = 'hex' | 'base64' | 'utf8';
export type AesKeySize = 128 | 192 | 256;

export interface AesModeInfo {
  value: AesMode
  label: string
  description: string
  ivLabel: string
  ivLength: number
  needsIv: boolean
  isAuthenticated: boolean
}

export const aesModes: AesModeInfo[] = [
  {
    value: 'CBC',
    label: 'CBC (Cipher Block Chaining)',
    description: 'PKCS#7 padding. Requires a 16-byte IV. No integrity check.',
    ivLabel: 'IV',
    ivLength: 16,
    needsIv: true,
    isAuthenticated: false,
  },
  {
    value: 'GCM',
    label: 'GCM (Galois/Counter Mode)',
    description: 'Authenticated encryption. The 16-byte authentication tag is appended to the ciphertext. 12-byte IV recommended.',
    ivLabel: 'IV / nonce',
    ivLength: 12,
    needsIv: true,
    isAuthenticated: true,
  },
  {
    value: 'CTR',
    label: 'CTR (Counter)',
    description: 'Stream mode, no padding. Requires a 16-byte counter block. No integrity check.',
    ivLabel: 'Counter (IV)',
    ivLength: 16,
    needsIv: true,
    isAuthenticated: false,
  },
  {
    value: 'ECB',
    label: 'ECB (Electronic Codebook)',
    description: 'PKCS#7 padding, no IV. Insecure for anything beyond a single block; provided for compatibility only.',
    ivLabel: 'IV',
    ivLength: 0,
    needsIv: false,
    isAuthenticated: false,
  },
];

export function getAesModeInfo(mode: AesMode): AesModeInfo {
  return aesModes.find(m => m.value === mode)!;
}

export function decodeBytes(input: string, encoding: BytesEncoding): Uint8Array {
  if (encoding === 'utf8') {
    return new TextEncoder().encode(input);
  }

  const cleaned = input.replace(/\s+/g, '');

  if (encoding === 'hex') {
    if (cleaned.length % 2 !== 0 || /[^0-9a-f]/i.test(cleaned)) {
      throw new Error('Invalid hexadecimal string');
    }

    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new Error('Invalid base64 string');
  }

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeBytes(bytes: Uint8Array, encoding: BytesEncoding): string {
  if (encoding === 'utf8') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  if (encoding === 'hex') {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function getAesKeySize(key: Uint8Array): AesKeySize {
  const bits = key.length * 8;

  if (bits !== 128 && bits !== 192 && bits !== 256) {
    throw new Error(`Invalid key length: ${key.length} bytes. AES keys must be 16, 24 or 32 bytes (128, 192 or 256 bits).`);
  }

  return bits;
}

export function validateIv(iv: Uint8Array, mode: AesMode): string | undefined {
  const info = getAesModeInfo(mode);

  if (!info.needsIv) {
    return undefined;
  }

  if (mode === 'GCM') {
    return iv.length === 0 ? 'GCM requires a non-empty IV (12 bytes recommended)' : undefined;
  }

  return iv.length === info.ivLength ? undefined : `${mode} requires a ${info.ivLength}-byte ${info.ivLabel.toLowerCase()}, got ${iv.length} bytes`;
}

interface AesOperationParams {
  key: Uint8Array
  iv?: Uint8Array
  mode: AesMode
  additionalData?: Uint8Array
}

function toWordArray(bytes: Uint8Array): lib.WordArray {
  return lib.WordArray.create(bytes as unknown as number[]);
}

function fromWordArray(wordArray: lib.WordArray): Uint8Array {
  const bytes = new Uint8Array(Math.max(wordArray.sigBytes, 0));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
  }
  return bytes;
}

function getCryptoJsConfig({ mode, iv }: { mode: AesMode; iv?: Uint8Array }) {
  const modes = {
    CBC: { mode: cryptoJsMode.CBC, padding: pad.Pkcs7 },
    CTR: { mode: cryptoJsMode.CTR, padding: pad.NoPadding },
    ECB: { mode: cryptoJsMode.ECB, padding: pad.Pkcs7 },
  } as const;

  if (mode === 'GCM') {
    throw new Error('GCM is not handled by crypto-js');
  }

  return { ...modes[mode], iv: iv ? toWordArray(iv) : undefined };
}

async function encryptGcm({ plaintext, key, iv, additionalData }: { plaintext: Uint8Array; key: Uint8Array; iv: Uint8Array; additionalData?: Uint8Array }) {
  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, cryptoKey, plaintext);
  return new Uint8Array(ciphertext);
}

async function decryptGcm({ ciphertext, key, iv, additionalData }: { ciphertext: Uint8Array; key: Uint8Array; iv: Uint8Array; additionalData?: Uint8Array }) {
  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);

  try {
    const plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, cryptoKey, ciphertext);
    return new Uint8Array(plaintext);
  }
  catch {
    throw new Error('Authentication failed: wrong key, IV, additional data, or the ciphertext has been tampered with');
  }
}

export async function encryptAes({ plaintext, key, iv, mode, additionalData }: AesOperationParams & { plaintext: Uint8Array }): Promise<Uint8Array> {
  getAesKeySize(key);
  const ivBytes = iv ?? new Uint8Array(0);
  const ivError = validateIv(ivBytes, mode);
  if (ivError) {
    throw new Error(ivError);
  }

  if (mode === 'GCM') {
    return encryptGcm({ plaintext, key, iv: ivBytes, additionalData });
  }

  const result = AES.encrypt(toWordArray(plaintext), toWordArray(key), getCryptoJsConfig({ mode, iv: ivBytes }));
  return fromWordArray(result.ciphertext);
}

export async function decryptAes({ ciphertext, key, iv, mode, additionalData }: AesOperationParams & { ciphertext: Uint8Array }): Promise<Uint8Array> {
  getAesKeySize(key);
  const ivBytes = iv ?? new Uint8Array(0);
  const ivError = validateIv(ivBytes, mode);
  if (ivError) {
    throw new Error(ivError);
  }

  if (mode === 'GCM') {
    if (ciphertext.length < 16) {
      throw new Error('Ciphertext is too short: GCM ciphertext must include the 16-byte authentication tag');
    }
    return decryptGcm({ ciphertext, key, iv: ivBytes, additionalData });
  }

  if (mode !== 'CTR' && ciphertext.length % 16 !== 0) {
    throw new Error(`Ciphertext length must be a multiple of 16 bytes for ${mode}, got ${ciphertext.length} bytes`);
  }

  const cipherParams = lib.CipherParams.create({ ciphertext: toWordArray(ciphertext) });
  const result = AES.decrypt(cipherParams, toWordArray(key), getCryptoJsConfig({ mode, iv: ivBytes }));

  if (result.sigBytes < 0 || (mode !== 'CTR' && result.sigBytes > ciphertext.length - 1)) {
    throw new Error('Unable to decrypt: wrong key, IV, or corrupted ciphertext (invalid padding)');
  }

  return fromWordArray(result);
}
