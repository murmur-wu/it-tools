import { describe, expect, it } from 'vitest';
import {
  VideoCompressionError,
  buildOutputFilename,
  getMimeTypeForFormat,
  getTargetDimensions,
  isVideoCompressionSupported,
} from './video-compressor.service';

describe('video-compressor', () => {
  describe('getTargetDimensions', () => {
    it('keeps the source size when no limit is given', () => {
      expect(getTargetDimensions({ width: 1920, height: 1080 })).toEqual({ width: 1920, height: 1080, downscaled: false });
    });

    it('keeps the source size when it is already within the limit', () => {
      expect(getTargetDimensions({ width: 1280, height: 720, maxHeight: 1080 })).toEqual({ width: 1280, height: 720, downscaled: false });
    });

    it('scales down to the limit while keeping the aspect ratio', () => {
      expect(getTargetDimensions({ width: 3840, height: 2160, maxHeight: 1080 })).toEqual({ width: 1920, height: 1080, downscaled: true });
      expect(getTargetDimensions({ width: 1080, height: 1920, maxHeight: 720 })).toEqual({ width: 406, height: 720, downscaled: true });
    });

    it('rounds to even dimensions like the encoder requires', () => {
      expect(getTargetDimensions({ width: 1000, height: 999, maxHeight: 333 })).toEqual({ width: 334, height: 334, downscaled: true });
    });
  });

  describe('buildOutputFilename', () => {
    it('replaces the extension with the output format', () => {
      expect(buildOutputFilename({ name: 'holiday.MOV', format: 'mp4' })).toBe('holiday.mp4');
      expect(buildOutputFilename({ name: 'clip.mp4', format: 'webm' })).toBe('clip.webm');
    });

    it('falls back to a name when the file only has an extension', () => {
      expect(buildOutputFilename({ name: '.mp4', format: 'mp4' })).toBe('video.mp4');
    });
  });

  describe('getMimeTypeForFormat', () => {
    it('maps each format to its media type', () => {
      expect(getMimeTypeForFormat('mp4')).toBe('video/mp4');
      expect(getMimeTypeForFormat('webm')).toBe('video/webm');
    });
  });

  describe('isVideoCompressionSupported', () => {
    it('is false without WebCodecs, as in this test environment', () => {
      expect(isVideoCompressionSupported()).toBe(false);
    });
  });

  describe('VideoCompressionError', () => {
    it('carries a machine-readable code', () => {
      const error = new VideoCompressionError('no-video-track');
      expect(error.code).toBe('no-video-track');
      expect(error.message).toBe('no-video-track');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
