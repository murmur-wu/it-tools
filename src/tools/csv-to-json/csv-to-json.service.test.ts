import { describe, expect, it } from 'vitest';
import { csvToJson, detectDelimiter, inferValue, parseCsv } from './csv-to-json.service';

describe('csv-to-json service', () => {
  describe('parseCsv', () => {
    it('parses a simple file with a header row', () => {
      expect(parseCsv('a,b\n1,2\n3,4')).toEqual({ headers: ['a', 'b'], rows: [['1', '2'], ['3', '4']] });
    });

    it('keeps every row when there is no header', () => {
      expect(parseCsv('1,2\n3,4', { hasHeader: false })).toEqual({ headers: [], rows: [['1', '2'], ['3', '4']] });
    });

    it('handles quoted fields containing the delimiter, quotes and line breaks', () => {
      const csv = 'name,note\n"Doe, John","He said ""hi"""\n"multi\nline",ok';

      expect(parseCsv(csv)).toEqual({
        headers: ['name', 'note'],
        rows: [['Doe, John', 'He said "hi"'], ['multi\nline', 'ok']],
      });
    });

    it('handles CRLF line endings and a trailing newline', () => {
      expect(parseCsv('a,b\r\n1,2\r\n')).toEqual({ headers: ['a', 'b'], rows: [['1', '2']] });
    });

    it('keeps empty fields', () => {
      expect(parseCsv('a,b,c\n1,,3')).toEqual({ headers: ['a', 'b', 'c'], rows: [['1', '', '3']] });
    });

    it('optionally trims values', () => {
      expect(parseCsv('a,b\n 1 , 2 ', { trimValues: true }).rows).toEqual([['1', '2']]);
      expect(parseCsv('a,b\n 1 , 2 ').rows).toEqual([[' 1 ', ' 2 ']]);
    });
  });

  describe('detectDelimiter', () => {
    it('detects the delimiter that gives consistent columns', () => {
      expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
      expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
      expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
      expect(detectDelimiter('a|b\n1|2')).toBe('|');
    });

    it('is not fooled by a delimiter inside a quoted field', () => {
      expect(detectDelimiter('name;note\n"Doe, John";ok\n"Roe, Jane";ok')).toBe(';');
    });

    it('falls back to a comma for a single column', () => {
      expect(detectDelimiter('value\n1\n2')).toBe(',');
      expect(detectDelimiter('')).toBe(',');
    });
  });

  describe('inferValue', () => {
    it('infers numbers, booleans and null', () => {
      expect(inferValue('42')).toBe(42);
      expect(inferValue('-3.5')).toBe(-3.5);
      expect(inferValue('true')).toBe(true);
      expect(inferValue('false')).toBe(false);
      expect(inferValue('null')).toBeNull();
    });

    it('keeps values that would lose information as strings', () => {
      expect(inferValue('007')).toBe('007');
      expect(inferValue('+1 234')).toBe('+1 234');
      expect(inferValue('12345678901234567890')).toBe('12345678901234567890');
      expect(inferValue('1.0')).toBe('1.0');
      expect(inferValue('0x10')).toBe('0x10');
    });

    it('keeps empty values as an empty string', () => {
      expect(inferValue('')).toBe('');
      expect(inferValue('  ')).toBe('');
    });
  });

  describe('csvToJson', () => {
    it('converts a CSV with a header into an array of objects', () => {
      expect(csvToJson('name,age\nJohn,42\nJane,37').data).toEqual([
        { name: 'John', age: 42 },
        { name: 'Jane', age: 37 },
      ]);
    });

    it('converts a headerless CSV into an array of arrays', () => {
      expect(csvToJson('1,2\n3,4', { hasHeader: false }).data).toEqual([[1, 2], [3, 4]]);
    });

    it('can keep every value as a string', () => {
      expect(csvToJson('a,b\n1,true', { inferTypes: false }).data).toEqual([{ a: '1', b: 'true' }]);
    });

    it('fills missing trailing columns with an empty value', () => {
      expect(csvToJson('a,b,c\n1,2').data).toEqual([{ a: 1, b: 2, c: '' }]);
    });

    it('auto-detects the delimiter', () => {
      expect(csvToJson('a;b\n1;2').data).toEqual([{ a: 1, b: 2 }]);
    });

    it('returns nothing for an empty input', () => {
      expect(csvToJson('   ')).toEqual({ headers: [], rows: [], data: [] });
    });

    it('round-trips a CSV produced by the JSON to CSV tool', () => {
      const csv = 'a,b\n"hello, world","he said ""hi"""';

      expect(csvToJson(csv).data).toEqual([{ a: 'hello, world', b: 'he said "hi"' }]);
    });
  });
});
