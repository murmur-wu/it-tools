import loadGhostscript from '@okathira/ghostpdl-wasm';
import wasmUrl from '@okathira/ghostpdl-wasm/gs.wasm?url';
import { PdfCompressionError, compressPdf } from './pdf-compressor.service';
import type { CompressRequest, CompressResponse } from './pdf-compressor.types';

// The ~15 MB engine is downloaded once per worker; each job gets a fresh Ghostscript instance built
// from it, because Ghostscript's global state is not meant to be reused across runs.
let wasmBinary: Promise<ArrayBuffer> | undefined;

function getWasmBinary(): Promise<ArrayBuffer> {
  wasmBinary ??= fetch(wasmUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .catch((error) => {
      // Allow a retry after a network failure
      wasmBinary = undefined;
      throw error;
    });

  return wasmBinary;
}

// The project's TypeScript config only includes DOM types, so describe the worker scope we use
const workerScope = globalThis as unknown as {
  postMessage: (message: CompressResponse, transfer: Transferable[]) => void
  onmessage: ((event: MessageEvent<CompressRequest>) => void) | null
};

function post(message: CompressResponse, transfer: Transferable[] = []) {
  workerScope.postMessage(message, transfer);
}

workerScope.onmessage = async ({ data }: MessageEvent<CompressRequest>) => {
  const { id, input, preset } = data;

  let binary: ArrayBuffer;
  try {
    post({ id, type: 'loading-engine' });
    binary = await getWasmBinary();
  }
  catch {
    post({ id, type: 'error', reason: 'engine' });
    return;
  }

  try {
    post({ id, type: 'progress', page: 0, total: 0 });
    const output = await compressPdf({
      input: new Uint8Array(input),
      preset,
      loadGhostscript: options => loadGhostscript({ ...options, wasmBinary: binary }),
      onProgress: ({ page, total }) => post({ id, type: 'progress', page, total }),
    });

    // Copy out of the WebAssembly memory so the buffer can be transferred
    const buffer = output.slice().buffer;
    post({ id, type: 'done', output: buffer }, [buffer]);
  }
  catch (error) {
    post({ id, type: 'error', reason: error instanceof PdfCompressionError ? error.reason : 'failed' });
  }
};
