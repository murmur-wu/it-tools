import type { CompressionErrorReason, CompressionPreset } from './pdf-compressor.service';

export interface CompressRequest {
  id: number
  input: ArrayBuffer
  preset: CompressionPreset
}

export type CompressResponse =
  | { id: number; type: 'loading-engine' }
  | { id: number; type: 'progress'; page: number; total: number }
  | { id: number; type: 'done'; output: ArrayBuffer }
  | { id: number; type: 'error'; reason: CompressionErrorReason | 'engine' };
