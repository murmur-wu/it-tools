import jsQR from 'jsqr';

export interface DecodableImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

const MAX_DECODE_DIMENSION = 2000;

export function decodeQrCode(image: DecodableImage): string | undefined {
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });

  return result?.data;
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load image'));
      image.src = url;
    });
  }
  finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeQrCodeFromFile(file: Blob): Promise<string | undefined> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DECODE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas is not supported');
  }

  context.drawImage(image, 0, 0, width, height);

  return decodeQrCode(context.getImageData(0, 0, width, height));
}
