import { describe, expect, it } from 'vitest';
import { detectTimestampUnit, parseTimestamp, parseTimestamps } from './timestamp-batch-converter.service';

describe('timestamp batch converter service', () => {
  describe('detectTimestampUnit', () => {
    it('guesses the unit from the digit count', () => {
      expect(detectTimestampUnit('1700000000')).toBe('seconds');
      expect(detectTimestampUnit('1700000000000')).toBe('milliseconds');
      expect(detectTimestampUnit('1700000000000000')).toBe('microseconds');
      expect(detectTimestampUnit('1700000000000000000')).toBe('nanoseconds');
    });

    it('ignores a sign and a fractional part', () => {
      expect(detectTimestampUnit('-1700000000')).toBe('seconds');
      expect(detectTimestampUnit('1700000000.5')).toBe('seconds');
    });
  });

  describe('parseTimestamp', () => {
    it('parses seconds, milliseconds, microseconds and nanoseconds', () => {
      expect(parseTimestamp('1700000000').date?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
      expect(parseTimestamp('1700000000000').date?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
      expect(parseTimestamp('1700000000000000').date?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
      expect(parseTimestamp('1700000000000000000').date?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
    });

    it('honours an explicit unit over the guess', () => {
      expect(parseTimestamp('1700000000', { unit: 'milliseconds' }).date?.toISOString()).toBe('1970-01-20T16:13:20.000Z');
    });

    it('supports fractional seconds and dates before 1970', () => {
      expect(parseTimestamp('1700000000.25').date?.toISOString()).toBe('2023-11-14T22:13:20.250Z');
      expect(parseTimestamp('-86400').date?.toISOString()).toBe('1969-12-31T00:00:00.000Z');
    });

    it('reports values that are not numbers', () => {
      expect(parseTimestamp('hello').error).toBe('notANumber');
      expect(parseTimestamp('2023-11-14').error).toBe('notANumber');
      expect(parseTimestamp('').error).toBe('notANumber');
    });

    it('reports values outside the representable range', () => {
      expect(parseTimestamp('99999999999999999999', { unit: 'milliseconds' }).error).toBe('outOfRange');
    });
  });

  describe('parseTimestamps', () => {
    it('splits on newlines, commas, semicolons and tabs and drops blanks', () => {
      const results = parseTimestamps('1700000000\n1700000001,1700000002;\t1700000003\n\n');

      expect(results).toHaveLength(4);
      expect(results.map(({ raw }) => raw)).toEqual(['1700000000', '1700000001', '1700000002', '1700000003']);
    });

    it('keeps invalid entries in place so rows line up with the input', () => {
      const results = parseTimestamps('1700000000\noops\n1700000002');

      expect(results.map(({ error }) => error)).toEqual([undefined, 'notANumber', undefined]);
    });
  });
});
