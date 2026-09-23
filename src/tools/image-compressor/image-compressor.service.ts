export const outputFormats = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type OutputFormat = typeof outputFormats[number];

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
}

export function getTargetDimensions({
  width,
  height,
  maxWidth,
  maxHeight,
}: {
  width: number
  height: number
  maxWidth?: number
  maxHeight?: number
}): { width: number; height: number } {
  const widthRatio = maxWidth && maxWidth > 0 ? maxWidth / width : 1;
  const heightRatio = maxHeight && maxHeight > 0 ? maxHeight / height : 1;
  const ratio = Math.min(1, widthRatio, heightRatio);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export function getExtensionForFormat(format: OutputFormat): string {
  return { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[format];
}

export function buildOutputFilename({ name, format }: { name: string; format: OutputFormat }): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image';

  return `${base}.${getExtensionForFormat(format)}`;
}

export function getSavedRatio({ originalSize, compressedSize }: { originalSize: number; compressedSize: number }): number {
  if (originalSize === 0) {
    return 0;
  }

  return (originalSize - compressedSize) / originalSize;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read this image'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Unable to encode this image'))),
      format,
      // PNG ignores the quality argument, it is lossless.
      format === 'image/png' ? undefined : quality,
    );
  });
}

export async function compressImage({
  file,
  format,
  quality = 0.8,
  maxWidth,
  maxHeight,
}: {
  file: Blob
  format: OutputFormat
  quality?: number
  maxWidth?: number
  maxHeight?: number
}): Promise<CompressionResult> {
  const image = await loadImage(file);
  const { width, height } = getTargetDimensions({
    width: image.naturalWidth,
    height: image.naturalHeight,
    maxWidth,
    maxHeight,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported');
  }

  // JPEG has no alpha channel: without a white backdrop transparent areas turn black.
  if (format === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return { blob: await canvasToBlob(canvas, format, quality), width, height };
}
