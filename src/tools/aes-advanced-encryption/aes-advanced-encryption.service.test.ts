import { describe, expect, it } from 'vitest';
import { decodeBytes, decryptAes, encodeBytes, encryptAes, getAesKeySize, randomBytes, validateIv } from './aes-advanced-encryption.service';

const hex = (value: string) => decodeBytes(value, 'hex');
const toHex = (value: Uint8Array) => encodeBytes(value, 'hex');

// NIST SP 800-38A test vectors (AES-128)
const nistKey = hex('2b7e151628aed2a6abf7158809cf4f3c');
const nistBlock = hex('6bc1bee22e409f96e93d7e117393172a');

describe('aes-advanced-encryption', () => {
  describe('decodeBytes / encodeBytes', () => {
    it('round-trips hex', () => {
      expect(toHex(hex('00ff10'))).toBe('00ff10');
      expect(toHex(hex('00 FF 10'))).toBe('00ff10');
    });

    it('round-trips base64', () => {
      const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
      expect(decodeBytes(encodeBytes(bytes, 'base64'), 'base64')).toEqual(bytes);
    });

    it('round-trips utf8', () => {
      expect(encodeBytes(decodeBytes('héllo 🌍', 'utf8'), 'utf8')).toBe('héllo 🌍');
    });

    it('rejects malformed input', () => {
      expect(() => hex('abc')).toThrow('Invalid hexadecimal string');
      expect(() => hex('zz')).toThrow('Invalid hexadecimal string');
      expect(() => decodeBytes('not base64!', 'base64')).toThrow('Invalid base64 string');
      expect(() => encodeBytes(new Uint8Array([0xFF, 0xFE]), 'utf8')).toThrow();
    });
  });

  describe('getAesKeySize', () => {
    it('accepts 16, 24 and 32 byte keys', () => {
      expect(getAesKeySize(randomBytes(16))).toBe(128);
      expect(getAesKeySize(randomBytes(24))).toBe(192);
      expect(getAesKeySize(randomBytes(32))).toBe(256);
    });

    it('rejects other lengths', () => {
      expect(() => getAesKeySize(randomBytes(15))).toThrow('Invalid key length');
      expect(() => getAesKeySize(randomBytes(0))).toThrow('Invalid key length');
    });
  });

  describe('validateIv', () => {
    it('validates per mode', () => {
      expect(validateIv(randomBytes(16), 'CBC')).toBeUndefined();
      expect(validateIv(randomBytes(12), 'CBC')).toContain('16-byte');
      expect(validateIv(randomBytes(16), 'CTR')).toBeUndefined();
      expect(validateIv(randomBytes(12), 'GCM')).toBeUndefined();
      expect(validateIv(randomBytes(0), 'GCM')).toContain('non-empty');
      expect(validateIv(randomBytes(0), 'ECB')).toBeUndefined();
    });
  });

  describe('known answer tests', () => {
    it('matches NIST CBC-AES128 (F.2.1) for the first block', async () => {
      const iv = hex('000102030405060708090a0b0c0d0e0f');
      const ciphertext = await encryptAes({ plaintext: nistBlock, key: nistKey, iv, mode: 'CBC' });
      // 16-byte input + PKCS#7 padding gives 32 bytes; the first block must match the NIST vector
      expect(ciphertext.length).toBe(32);
      expect(toHex(ciphertext.slice(0, 16))).toBe('7649abac8119b246cee98e9b12e9197d');
    });

    it('matches NIST ECB-AES128 (F.1.1) for the first block', async () => {
      const ciphertext = await encryptAes({ plaintext: nistBlock, key: nistKey, mode: 'ECB' });
      expect(toHex(ciphertext.slice(0, 16))).toBe('3ad77bb40d7a3660a89ecaf32466ef97');
    });

    it('matches NIST CTR-AES128 (F.5.1)', async () => {
      const counter = hex('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
      const ciphertext = await encryptAes({ plaintext: nistBlock, key: nistKey, iv: counter, mode: 'CTR' });
      expect(ciphertext.length).toBe(16);
      expect(toHex(ciphertext)).toBe('874d6191b620e3261bef6864990db6ce');
    });

    it('matches the GCM spec test case 2 (ciphertext + tag)', async () => {
      const key = new Uint8Array(16);
      const iv = new Uint8Array(12);
      const plaintext = new Uint8Array(16);
      const ciphertext = await encryptAes({ plaintext, key, iv, mode: 'GCM' });
      expect(toHex(ciphertext)).toBe('0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf');
    });
  });

  describe('round trips', () => {
    const message = decodeBytes('The quick brown fox jumps over the lazy dog 🦊', 'utf8');

    it.each([
      ['CBC', 16, 16],
      ['CBC', 24, 16],
      ['CBC', 32, 16],
      ['CTR', 32, 16],
      ['ECB', 32, 0],
      ['GCM', 16, 12],
      ['GCM', 32, 12],
    ] as const)('%s with a %d-byte key and a %d-byte IV', async (mode, keyLength, ivLength) => {
      const key = randomBytes(keyLength);
      const iv = randomBytes(ivLength);
      const ciphertext = await encryptAes({ plaintext: message, key, iv, mode });
      expect(ciphertext).not.toEqual(message);
      const plaintext = await decryptAes({ ciphertext, key, iv, mode });
      expect(plaintext).toEqual(message);
    });

    it('handles empty plaintext', async () => {
      const key = randomBytes(16);
      const iv = randomBytes(16);
      const ciphertext = await encryptAes({ plaintext: new Uint8Array(0), key, iv, mode: 'CBC' });
      expect(ciphertext.length).toBe(16);
      expect(await decryptAes({ ciphertext, key, iv, mode: 'CBC' })).toEqual(new Uint8Array(0));
    });

    it('GCM round-trips with additional data', async () => {
      const key = randomBytes(32);
      const iv = randomBytes(12);
      const additionalData = decodeBytes('header', 'utf8');
      const ciphertext = await encryptAes({ plaintext: message, key, iv, mode: 'GCM', additionalData });
      expect(await decryptAes({ ciphertext, key, iv, mode: 'GCM', additionalData })).toEqual(message);
    });
  });

  describe('failures', () => {
    it('GCM rejects a tampered ciphertext, a wrong key and mismatched additional data', async () => {
      const key = randomBytes(32);
      const iv = randomBytes(12);
      const additionalData = decodeBytes('header', 'utf8');
      const ciphertext = await encryptAes({ plaintext: nistBlock, key, iv, mode: 'GCM', additionalData });

      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0x01;
      await expect(decryptAes({ ciphertext: tampered, key, iv, mode: 'GCM', additionalData })).rejects.toThrow('Authentication failed');
      await expect(decryptAes({ ciphertext, key: randomBytes(32), iv, mode: 'GCM', additionalData })).rejects.toThrow('Authentication failed');
      await expect(decryptAes({ ciphertext, key, iv, mode: 'GCM' })).rejects.toThrow('Authentication failed');
      await expect(decryptAes({ ciphertext: randomBytes(8), key, iv, mode: 'GCM' })).rejects.toThrow('too short');
    });

    it('CBC rejects a ciphertext that is not block aligned', async () => {
      await expect(decryptAes({ ciphertext: randomBytes(17), key: randomBytes(16), iv: randomBytes(16), mode: 'CBC' })).rejects.toThrow('multiple of 16');
    });

    it('rejects an invalid key or IV', async () => {
      await expect(encryptAes({ plaintext: nistBlock, key: randomBytes(10), iv: randomBytes(16), mode: 'CBC' })).rejects.toThrow('Invalid key length');
      await expect(encryptAes({ plaintext: nistBlock, key: randomBytes(16), iv: randomBytes(8), mode: 'CBC' })).rejects.toThrow('16-byte');
    });
  });
});
