import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyFigletFonts, figletFontsDir, listFigletFonts } from './figlet-fonts';

describe('figlet-fonts', () => {
  const outDirs: string[] = [];

  afterEach(() => {
    for (const outDir of outDirs.splice(0)) {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('finds the fonts shipped with the figlet package', () => {
    const fonts = listFigletFonts();

    expect(fonts.length).toBeGreaterThan(250);
    expect(fonts).toContain('Standard.flf');
    expect(fonts).toContain('3D Diagonal.flf');
    expect(fonts.every(fileName => fileName.endsWith('.flf'))).toBe(true);
  });

  it('copies every font into the output directory', () => {
    const outDir = mkdtempSync(resolve(tmpdir(), 'figlet-fonts-'));
    outDirs.push(outDir);

    const fonts = copyFigletFonts({ outDir });

    expect(fonts).toEqual(listFigletFonts());
    for (const fileName of fonts) {
      expect(existsSync(resolve(outDir, fileName))).toBe(true);
    }
    expect(readFileSync(resolve(outDir, 'Standard.flf'), 'utf-8')).toBe(readFileSync(resolve(figletFontsDir(), 'Standard.flf'), 'utf-8'));
  });
});
