import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import loadGhostscript from '@okathira/ghostpdl-wasm';
import {
  PdfCompressionError,
  buildGhostscriptArgs,
  buildOutputFilename,
  compressPdf,
  detectGhostscriptError,
  getSavedRatio,
  isPdf,
  parseProgressLine,
} from './pdf-compressor.service';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));
const encode = (text: string) => new TextEncoder().encode(text);

describe('pdf-compressor service', () => {
  describe('buildGhostscriptArgs', () => {
    it('writes a PDF with the chosen preset', () => {
      const args = buildGhostscriptArgs({ preset: 'ebook' });

      expect(args).toContain('-sDEVICE=pdfwrite');
      expect(args).toContain('-dPDFSETTINGS=/ebook');
      expect(args).toContain('-dBATCH');
      expect(args).toContain('-dSAFER');
    });
  });

  describe('isPdf', () => {
    it('accepts a PDF header, even after a few leading bytes', () => {
      expect(isPdf(encode('%PDF-1.7\n'))).toBe(true);
      expect(isPdf(encode('\n\n%PDF-1.4\n'))).toBe(true);
    });

    it('rejects other files', () => {
      expect(isPdf(encode('PK\u0003\u0004 zip file'))).toBe(false);
      expect(isPdf(new Uint8Array())).toBe(false);
    });
  });

  describe('parseProgressLine', () => {
    it('reads the page count and the current page', () => {
      expect(parseProgressLine('Processing pages 1 through 12.')).toEqual({ total: 12 });
      expect(parseProgressLine('Page 3')).toEqual({ page: 3 });
    });

    it('ignores other output', () => {
      expect(parseProgressLine('GPL Ghostscript 10.06.0 (2025-09-09)')).toBeNull();
      expect(parseProgressLine('Page 3 of something')).toBeNull();
    });
  });

  describe('detectGhostscriptError', () => {
    it('recognises password-protected files', () => {
      expect(detectGhostscriptError(['GPL Ghostscript 10.06.0: ', '   **** This file requires a password for access.'])).toBe('password');
    });

    it('recognises unreadable files', () => {
      expect(detectGhostscriptError(['   **** Error: Couldn\'t initialise file.', '   No pages will be processed (FirstPage > LastPage).'])).toBe('invalid');
      expect(detectGhostscriptError(['Processing pages 1 through 1.', '   **** Error: page not found.'])).toBe('invalid');
    });

    it('does not fail files that were only repaired', () => {
      expect(detectGhostscriptError(['   **** This file had errors that were repaired or ignored.', '\txref table was repaired'])).toBeNull();
      expect(detectGhostscriptError([])).toBeNull();
    });
  });

  describe('buildOutputFilename', () => {
    it('adds a suffix before the extension', () => {
      expect(buildOutputFilename('report.pdf')).toBe('report-compressed.pdf');
      expect(buildOutputFilename('Scan 2026.PDF')).toBe('Scan 2026-compressed.pdf');
      expect(buildOutputFilename('.pdf')).toBe('document-compressed.pdf');
    });
  });

  describe('getSavedRatio', () => {
    it('is positive when the file got smaller and negative when it grew', () => {
      expect(getSavedRatio({ originalSize: 1000, compressedSize: 250 })).toBe(0.75);
      expect(getSavedRatio({ originalSize: 1000, compressedSize: 1100 })).toBeCloseTo(-0.1);
      expect(getSavedRatio({ originalSize: 0, compressedSize: 0 })).toBe(0);
    });
  });

  // These run the real Ghostscript WebAssembly build, the same one the browser worker loads
  describe('compressPdf', () => {
    it('shrinks a scanned page and reports progress', async () => {
      const input = fixture('scanned-page.pdf');
      const progress: { page: number; total: number }[] = [];

      const output = await compressPdf({ input, preset: 'screen', loadGhostscript, onProgress: p => progress.push(p) });

      expect(isPdf(output)).toBe(true);
      expect(output.length).toBeLessThan(input.length / 2);
      expect(progress).toEqual([{ page: 1, total: 1 }]);
    }, 60_000);

    it('rejects password-protected files instead of returning a blank PDF', async () => {
      await expect(compressPdf({ input: fixture('password-protected.pdf'), preset: 'ebook', loadGhostscript }))
        .rejects.toMatchObject({ reason: 'password' });
    }, 60_000);

    it('rejects files that are not PDFs without starting Ghostscript', async () => {
      let started = false;
      const error = await compressPdf({
        input: encode('hello'),
        preset: 'ebook',
        loadGhostscript: async (options) => {
          started = true;
          return loadGhostscript(options);
        },
      }).catch(e => e);

      expect(error).toBeInstanceOf(PdfCompressionError);
      expect(error.reason).toBe('notPdf');
      expect(started).toBe(false);
    });

    it('rejects a damaged PDF instead of returning an empty one', async () => {
      await expect(compressPdf({ input: encode('%PDF-1.7\nthis is not really a pdf'), preset: 'ebook', loadGhostscript }))
        .rejects.toMatchObject({ reason: 'invalid' });

      const truncated = fixture('scanned-page.pdf');
      await expect(compressPdf({ input: truncated.subarray(0, truncated.length / 2), preset: 'ebook', loadGhostscript }))
        .rejects.toMatchObject({ reason: 'invalid' });
    }, 60_000);
  });
});
