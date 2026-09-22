import { describe, expect, it } from 'vitest';
import { buildShareUrl } from './toolInput';

describe('buildShareUrl', () => {
  it('puts the input in the query string, encoded', () => {
    expect(buildShareUrl({ origin: 'https://ittools.heitang.info', path: '/json-prettify', input: '{"a": 1}' }))
      .toBe('https://ittools.heitang.info/json-prettify?input=%7B%22a%22%3A+1%7D');
  });

  it('keeps unicode and newlines round-trippable', () => {
    const input = '第一行\n第二行 & more';
    const url = new URL(buildShareUrl({ origin: 'https://ittools.heitang.info', path: '/text-statistics', input }));
    expect(url.pathname).toBe('/text-statistics');
    expect(url.searchParams.get('input')).toBe(input);
  });
});
