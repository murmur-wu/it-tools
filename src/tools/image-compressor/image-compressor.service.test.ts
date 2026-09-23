import { describe, expect, it } from 'vitest';
import { buildOutputFilename, getExtensionForFormat, getSavedRatio, getTargetDimensions } from './image-compressor.service';

describe('image compressor service', () => {
  describe('getTargetDimensions', () => {
    it('keeps the original size when it already fits', () => {
      expect(getTargetDimensions({ width: 800, height: 600, maxWidth: 1000, maxHeight: 1000 }))
        .toEqual({ width: 800, height: 600 });
    });

    it('never enlarges an image', () => {
      expect(getTargetDimensions({ width: 100, height: 50, maxWidth: 4000 })).toEqual({ width: 100, height: 50 });
    });

    it('scales down preserving the aspect ratio', () => {
      expect(getTargetDimensions({ width: 4000, height: 3000, maxWidth: 1000 })).toEqual({ width: 1000, height: 750 });
      expect(getTargetDimensions({ width: 4000, height: 3000, maxHeight: 600 })).toEqual({ width: 800, height: 600 });
    });

    it('honours the most restrictive constraint', () => {
      expect(getTargetDimensions({ width: 4000, height: 3000, maxWidth: 1000, maxHeight: 600 }))
        .toEqual({ width: 800, height: 600 });
    });

    it('ignores empty constraints and never goes below one pixel', () => {
      expect(getTargetDimensions({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 });
      expect(getTargetDimensions({ width: 1200, height: 800, maxWidth: 0 })).toEqual({ width: 1200, height: 800 });
      expect(getTargetDimensions({ width: 1200, height: 800, maxWidth: 1 })).toEqual({ width: 1, height: 1 });
    });
  });

  describe('buildOutputFilename', () => {
    it('swaps the extension for the target format', () => {
      expect(buildOutputFilename({ name: 'holiday.png', format: 'image/webp' })).toBe('holiday.webp');
      expect(buildOutputFilename({ name: 'archive.tar.gz', format: 'image/jpeg' })).toBe('archive.tar.jpg');
      expect(buildOutputFilename({ name: 'no-extension', format: 'image/png' })).toBe('no-extension.png');
      expect(buildOutputFilename({ name: '.hidden', format: 'image/webp' })).toBe('image.webp');
    });
  });

  describe('getExtensionForFormat', () => {
    it('maps every supported format', () => {
      expect(getExtensionForFormat('image/webp')).toBe('webp');
      expect(getExtensionForFormat('image/jpeg')).toBe('jpg');
      expect(getExtensionForFormat('image/png')).toBe('png');
    });
  });

  describe('getSavedRatio', () => {
    it('computes the saved ratio', () => {
      expect(getSavedRatio({ originalSize: 1000, compressedSize: 250 })).toBe(0.75);
      expect(getSavedRatio({ originalSize: 1000, compressedSize: 1200 })).toBeCloseTo(-0.2);
      expect(getSavedRatio({ originalSize: 0, compressedSize: 0 })).toBe(0);
    });
  });
});
