import { describe, expect, it } from 'vitest';
import { convertChinese, countChineseCharacters } from './chinese-converter.service';

describe('chinese converter', () => {
  it('converts simplified to traditional (Taiwan)', () => {
    expect(convertChinese({ text: '这是一个测试，软件和硬件。', from: 'cn', to: 'tw' })).toBe('這是一個測試，軟件和硬件。');
  });

  it('applies Taiwanese phrases when asked', () => {
    expect(convertChinese({ text: '这是一个测试，软件和硬件。', from: 'cn', to: 'twp' })).toBe('這是一個測試，軟體和硬體。');
    expect(convertChinese({ text: '打印机和服务器', from: 'cn', to: 'twp' })).toBe('印表機和伺服器');
  });

  it('converts traditional to simplified', () => {
    expect(convertChinese({ text: '這是一個測試，軟體和硬體。', from: 'tw', to: 'cn' })).toBe('这是一个测试，软体和硬体。');
  });

  it('keeps non-Chinese text and punctuation untouched', () => {
    expect(convertChinese({ text: 'Hello 世界! 123\n第二行', from: 'cn', to: 'tw' })).toBe('Hello 世界! 123\n第二行');
  });

  it('returns the input as is when source and target are the same or the text is empty', () => {
    expect(convertChinese({ text: '简体', from: 'cn', to: 'cn' })).toBe('简体');
    expect(convertChinese({ text: '', from: 'cn', to: 'tw' })).toBe('');
  });

  it('counts Chinese characters', () => {
    expect(countChineseCharacters('Hello 世界，你好！')).toBe(4);
    expect(countChineseCharacters('abc')).toBe(0);
  });
});
