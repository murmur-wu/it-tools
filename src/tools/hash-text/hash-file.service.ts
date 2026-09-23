import type { IHasher } from 'hash-wasm';
import {
  createKeccak,
  createMD5,
  createRIPEMD160,
  createSHA1,
  createSHA224,
  createSHA256,
  createSHA384,
  createSHA512,
} from 'hash-wasm';
import { convertHexToBin } from './hash-text.service';

export const fileHashAlgorithms = ['MD5', 'SHA1', 'SHA256', 'SHA224', 'SHA512', 'SHA384', 'SHA3', 'RIPEMD160'] as const;
export type FileHashAlgorithm = typeof fileHashAlgorithms[number];
export type DigestEncoding = 'Hex' | 'Base64' | 'Base64url' | 'Bin';

const hasherFactories: Record<FileHashAlgorithm, () => Promise<IHasher>> = {
  MD5: createMD5,
  SHA1: createSHA1,
  SHA224: createSHA224,
  SHA256: createSHA256,
  SHA384: createSHA384,
  SHA512: createSHA512,
  // crypto-js "SHA3" is actually Keccak-512 (pre-NIST padding); mirror it so text and file digests agree.
  SHA3: () => createKeccak(512),
  RIPEMD160: createRIPEMD160,
};

export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

function readChunk(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  // Fallback for older browsers (and jsdom) without Blob.prototype.arrayBuffer
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function hashFile({
  file,
  algorithms,
  chunkSize = DEFAULT_CHUNK_SIZE,
  onProgress,
  signal,
}: {
  file: Blob
  algorithms: readonly FileHashAlgorithm[]
  chunkSize?: number
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}): Promise<Partial<Record<FileHashAlgorithm, Uint8Array>>> {
  const hashers = await Promise.all(algorithms.map(async algorithm => ({ algorithm, hasher: await hasherFactories[algorithm]() })));
  hashers.forEach(({ hasher }) => hasher.init());

  const total = file.size;
  let offset = 0;

  while (offset < total) {
    if (signal?.aborted) {
      throw new DOMException('Hashing aborted', 'AbortError');
    }

    const chunk = new Uint8Array(await readChunk(file.slice(offset, offset + chunkSize)));
    hashers.forEach(({ hasher }) => hasher.update(chunk));
    offset += chunk.byteLength;
    onProgress?.(total === 0 ? 1 : offset / total);
  }

  onProgress?.(1);

  return Object.fromEntries(hashers.map(({ algorithm, hasher }) => [algorithm, hasher.digest('binary')]));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));

  return btoa(binary);
}

export function formatDigest(bytes: Uint8Array, encoding: DigestEncoding): string {
  switch (encoding) {
    case 'Hex':
      return bytesToHex(bytes);
    case 'Base64':
      return bytesToBase64(bytes);
    case 'Base64url':
      return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    case 'Bin':
      return convertHexToBin(bytesToHex(bytes));
  }
}

export function normalizeHashForComparison(value: string): string {
  return value.trim().replace(/[\s:-]/g, '').toLowerCase();
}
