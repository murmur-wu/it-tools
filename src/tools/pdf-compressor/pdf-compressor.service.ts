import type { GhostscriptModule } from '@okathira/ghostpdl-wasm';

export const compressionPresets = ['screen', 'ebook', 'printer'] as const;
export type CompressionPreset = typeof compressionPresets[number];

// Image resolution Ghostscript downsamples to for each -dPDFSETTINGS preset
export const presetResolution: Record<CompressionPreset, number> = {
  screen: 72,
  ebook: 150,
  printer: 300,
};

export type CompressionErrorReason = 'notPdf' | 'password' | 'invalid' | 'failed';

export class PdfCompressionError extends Error {
  constructor(public readonly reason: CompressionErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'PdfCompressionError';
  }
}

const inputPath = '/input.pdf';
const outputPath = '/output.pdf';

export function buildGhostscriptArgs({ preset }: { preset: CompressionPreset }): string[] {
  return [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    `-dPDFSETTINGS=/${preset}`,
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
}

// The header may be preceded by a few bytes of garbage, readers accept it within the first 1 KB
export function isPdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

// Ghostscript prints "Processing pages 1 through 12." then "Page 1", "Page 2", ...
export function parseProgressLine(line: string): { total: number } | { page: number } | null {
  const total = line.match(/^Processing pages \d+ through (\d+)\./);
  if (total) {
    return { total: Number(total[1]) };
  }

  const page = line.match(/^Page (\d+)$/);
  if (page) {
    return { page: Number(page[1]) };
  }

  return null;
}

// Ghostscript exits with 0 even when it could not open the file, so its messages (on both stdout
// and stderr) are the only signal. "Errors were repaired" alone is not fatal: many valid-looking
// PDFs are slightly malformed and still convert fine.
export function detectGhostscriptError(messages: string[]): CompressionErrorReason | null {
  const text = messages.join('\n');

  if (/requires a password/i.test(text)) {
    return 'password';
  }

  if (/Couldn't initialise file|No pages will be processed|page not found|Unrecoverable error/i.test(text)) {
    return 'invalid';
  }

  return null;
}

export function buildOutputFilename(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return `${base || 'document'}-compressed.pdf`;
}

export function getSavedRatio({ originalSize, compressedSize }: { originalSize: number; compressedSize: number }): number {
  return originalSize === 0 ? 0 : 1 - compressedSize / originalSize;
}

export async function compressPdf({
  input,
  preset,
  loadGhostscript,
  onProgress,
}: {
  input: Uint8Array
  preset: CompressionPreset
  loadGhostscript: (options: { print: (line: string) => void; printErr: (line: string) => void }) => Promise<GhostscriptModule>
  onProgress?: (progress: { page: number; total: number }) => void
}): Promise<Uint8Array> {
  if (!isPdf(input)) {
    throw new PdfCompressionError('notPdf');
  }

  const messages: string[] = [];
  let total = 0;

  const ghostscript = await loadGhostscript({
    print: (line) => {
      messages.push(line);
      const progress = parseProgressLine(line);
      if (progress && 'total' in progress) {
        total = progress.total;
      }
      else if (progress && total > 0) {
        onProgress?.({ page: progress.page, total });
      }
    },
    printErr: line => messages.push(line),
  });

  ghostscript.FS.writeFile(inputPath, input);

  let exitCode: number;
  try {
    exitCode = ghostscript.callMain(buildGhostscriptArgs({ preset }));
  }
  catch (error) {
    throw new PdfCompressionError('failed', String(error));
  }

  const reason = detectGhostscriptError(messages) ?? (exitCode === 0 ? null : 'failed');
  if (reason) {
    throw new PdfCompressionError(reason, messages.join('\n'));
  }

  try {
    return ghostscript.FS.readFile(outputPath);
  }
  catch {
    throw new PdfCompressionError('failed', 'No output file');
  }
}
