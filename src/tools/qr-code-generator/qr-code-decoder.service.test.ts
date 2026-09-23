import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { type DecodableImage, decodeQrCode } from './qr-code-decoder.service';

function renderQrCode(text: string, { scale = 4, margin = 4 } = {}): DecodableImage {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = (modules.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);

  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) {
        continue;
      }

      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (col + margin) * scale + dx;
          const y = (row + margin) * scale + dy;
          const offset = (y * size + x) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
      }
    }
  }

  return { data, width: size, height: size };
}

describe('qr code decoder service', () => {
  describe('decodeQrCode', () => {
    it('decodes a QR code rendered as raw pixels', () => {
      expect(decodeQrCode(renderQrCode('https://ittools.heitang.info'))).toBe('https://ittools.heitang.info');
      expect(decodeQrCode(renderQrCode('中文內容 OK'))).toBe('中文內容 OK');
    });

    it('returns undefined when the image holds no QR code', () => {
      const size = 64;
      const blank = { data: new Uint8ClampedArray(size * size * 4).fill(255), width: size, height: size };

      expect(decodeQrCode(blank)).toBeUndefined();
    });
  });
});
