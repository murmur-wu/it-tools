import { createHash, randomBytes } from 'node:crypto';
import { MD5, RIPEMD160, SHA1, SHA224, SHA256, SHA3, SHA384, SHA512, enc } from 'crypto-js';
import { describe, expect, it } from 'vitest';
import { bytesToHex, fileHashAlgorithms, formatDigest, hashFile, normalizeHashForComparison } from './hash-file.service';

const cryptoJsAlgos = { MD5, SHA1, SHA256, SHA224, SHA512, SHA384, SHA3, RIPEMD160 };

describe('hash file service', () => {
  describe('hashFile', () => {
    it('matches the text hashing algorithms used by the tool', async () => {
      const text = 'Hello world';
      const digests = await hashFile({ file: new Blob([text]), algorithms: fileHashAlgorithms });

      for (const algorithm of fileHashAlgorithms) {
        expect(bytesToHex(digests[algorithm]!), algorithm).toBe(cryptoJsAlgos[algorithm](text).toString(enc.Hex));
      }
    });

    it('hashes multi-chunk files exactly like a single read', async () => {
      const bytes = randomBytes(3 * 1024 * 1024 + 123);
      const expected = createHash('sha256').update(bytes).digest('hex');
      const progress: number[] = [];

      const digests = await hashFile({
        file: new Blob([bytes]),
        algorithms: ['SHA256', 'MD5'],
        chunkSize: 1024 * 1024,
        onProgress: ratio => progress.push(ratio),
      });

      expect(bytesToHex(digests.SHA256!)).toBe(expected);
      expect(bytesToHex(digests.MD5!)).toBe(createHash('md5').update(bytes).digest('hex'));
      expect(progress.at(-1)).toBe(1);
      expect(progress.length).toBeGreaterThan(3);
    });

    it('handles empty files', async () => {
      const digests = await hashFile({ file: new Blob([]), algorithms: ['SHA1'] });

      expect(bytesToHex(digests.SHA1!)).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });
  });

  describe('formatDigest', () => {
    const words = SHA256('abc');
    const bytes = new Uint8Array(words.toString(enc.Hex).match(/../g)!.map(h => Number.parseInt(h, 16)));

    it('formats with every supported encoding like crypto-js does', () => {
      expect(formatDigest(bytes, 'Hex')).toBe(words.toString(enc.Hex));
      expect(formatDigest(bytes, 'Base64')).toBe(words.toString(enc.Base64));
      expect(formatDigest(bytes, 'Base64url')).toBe(words.toString(enc.Base64url));
      expect(formatDigest(bytes, 'Bin')).toHaveLength(256);
    });
  });

  describe('normalizeHashForComparison', () => {
    it('ignores case, whitespace and separators', () => {
      expect(normalizeHashForComparison('  AB:CD-ef 01\n')).toBe('abcdef01');
    });
  });
});
