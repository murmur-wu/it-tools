import * as OpenCC from 'opencc-js';

export type ChineseVariant = 'cn' | 'tw' | 'twp' | 'hk' | 't';

export interface VariantOption {
  value: ChineseVariant
  label: string
  description: string
}

export const sourceVariants: VariantOption[] = [
  { value: 'cn', label: '簡體中文', description: '中國大陸用字' },
  { value: 'tw', label: '繁體中文（台灣）', description: '台灣正體用字' },
  { value: 'hk', label: '繁體中文（香港）', description: '香港用字' },
  { value: 't', label: '繁體中文（OpenCC 標準）', description: '不含地區用字' },
];

export const targetVariants: VariantOption[] = [
  { value: 'tw', label: '繁體中文（台灣）', description: '只轉換字形' },
  { value: 'twp', label: '繁體中文（台灣，含慣用詞）', description: '字形加上詞彙，例如「软件」→「軟體」' },
  { value: 'hk', label: '繁體中文（香港）', description: '香港用字' },
  { value: 't', label: '繁體中文（OpenCC 標準）', description: '不含地區用字' },
  { value: 'cn', label: '簡體中文', description: '中國大陸用字' },
];

type ConverterFunction = (text: string) => string;
const converters = new Map<string, ConverterFunction>();

function getConverter(from: ChineseVariant, to: ChineseVariant): ConverterFunction {
  const key = `${from}>${to}`;
  let converter = converters.get(key);
  if (!converter) {
    // OpenCC has no "from twp": Taiwanese phrases are handled on the "to" side only
    converter = OpenCC.Converter({ from, to } as OpenCC.ConverterOptions);
    converters.set(key, converter);
  }
  return converter;
}

export function convertChinese({ text, from, to }: { text: string; from: ChineseVariant; to: ChineseVariant }): string {
  if (from === to || text.length === 0) {
    return text;
  }
  return getConverter(from, to)(text);
}

export function countChineseCharacters(text: string): number {
  return (text.match(/[㐀-䶿一-鿿豈-﫿]/g) ?? []).length;
}
