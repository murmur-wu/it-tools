import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  type Quality,
  UnsupportedInputFormatError,
  WebMOutputFormat,
} from 'mediabunny';

export const outputFormats = ['mp4', 'webm'] as const;
export type OutputFormat = typeof outputFormats[number];

export const qualityLevels = ['high', 'medium', 'low'] as const;
export type QualityLevel = typeof qualityLevels[number];

// Maximum output height in pixels; the source is never upscaled
export const resolutionLimits = [2160, 1440, 1080, 720, 480] as const;

export type VideoCompressionErrorCode = 'no-video-track' | 'undecodable' | 'no-encoder' | 'unsupported-input' | 'canceled';

export class VideoCompressionError extends Error {
  constructor(public readonly code: VideoCompressionErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'VideoCompressionError';
  }
}

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  /** Duration of the source in seconds */
  duration: number
}

// Video and audio decoding/encoding rely on WebCodecs, which older Firefox and Safari versions lack
export function isVideoCompressionSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

export function getExtensionForFormat(format: OutputFormat): string {
  return format;
}

export function getMimeTypeForFormat(format: OutputFormat): string {
  return { mp4: 'video/mp4', webm: 'video/webm' }[format];
}

export function buildOutputFilename({ name, format }: { name: string; format: OutputFormat }): string {
  const base = name.replace(/\.[^.]+$/, '') || 'video';

  return `${base}.${getExtensionForFormat(format)}`;
}

// Mirrors how mediabunny derives the width when only a height is requested, so the UI can show the final size
function ceilToMultipleOfTwo(value: number): number {
  return Math.ceil(value / 2) * 2;
}

export function getTargetDimensions({
  width,
  height,
  maxHeight,
}: {
  width: number
  height: number
  maxHeight?: number
}): { width: number; height: number; downscaled: boolean } {
  if (!maxHeight || maxHeight <= 0 || height <= maxHeight) {
    return { width, height, downscaled: false };
  }

  const targetHeight = ceilToMultipleOfTwo(maxHeight);

  return {
    width: ceilToMultipleOfTwo(Math.round(targetHeight * (width / height))),
    height: targetHeight,
    downscaled: true,
  };
}

export function getQuality(level: QualityLevel): Quality {
  return { high: QUALITY_HIGH, medium: QUALITY_MEDIUM, low: QUALITY_LOW }[level];
}

function createOutputFormat(format: OutputFormat) {
  // fastStart puts the index at the front so the file starts playing before it is fully downloaded
  return format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
}

export async function compressVideo({
  file,
  format,
  quality,
  maxHeight,
  onProgress,
  signal,
}: {
  file: Blob
  format: OutputFormat
  quality: QualityLevel
  maxHeight?: number
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}): Promise<CompressionResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  try {
    const videoTrack = await input.getPrimaryVideoTrack().catch((error) => {
      if (error instanceof UnsupportedInputFormatError) {
        throw new VideoCompressionError('unsupported-input', error.message);
      }
      throw error;
    });

    if (!videoTrack) {
      throw new VideoCompressionError('no-video-track');
    }
    if (!(await videoTrack.canDecode())) {
      throw new VideoCompressionError('undecodable', `Cannot decode ${videoTrack.codec ?? 'unknown'} video in this browser`);
    }

    const duration = await input.computeDuration();
    const dimensions = getTargetDimensions({ width: videoTrack.displayWidth, height: videoTrack.displayHeight, maxHeight });

    const target = new BufferTarget();
    const output = new Output({ format: createOutputFormat(format), target });

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        // Only the height is given: mediabunny keeps the aspect ratio and rounds to even dimensions
        height: dimensions.downscaled ? dimensions.height : undefined,
        bitrate: getQuality(quality),
        // Copying the source packets would keep the original size, which defeats the purpose
        forceTranscode: true,
      },
      // Audio is copied when the container allows it, and re-encoded otherwise
    });

    const discardedVideo = conversion.discardedTracks.find(({ track }) => track === videoTrack);
    if (discardedVideo) {
      const code: VideoCompressionErrorCode = discardedVideo.reason === 'undecodable_source_codec' ? 'undecodable' : 'no-encoder';
      throw new VideoCompressionError(code, `Video track discarded: ${discardedVideo.reason}`);
    }

    conversion.onProgress = progress => onProgress?.(progress);

    const onAbort = () => {
      conversion.cancel();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      await conversion.execute();
    }
    catch (error) {
      if (error instanceof ConversionCanceledError || signal?.aborted) {
        throw new VideoCompressionError('canceled');
      }
      throw error;
    }
    finally {
      signal?.removeEventListener('abort', onAbort);
    }

    if (!target.buffer) {
      throw new Error('Conversion produced no data');
    }

    return {
      blob: new Blob([target.buffer], { type: getMimeTypeForFormat(format) }),
      width: dimensions.width,
      height: dimensions.height,
      duration,
    };
  }
  finally {
    input.dispose();
  }
}
