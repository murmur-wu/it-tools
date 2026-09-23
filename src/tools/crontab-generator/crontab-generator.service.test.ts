import { describe, expect, it } from 'vitest';
import { getNextCronRuns } from './crontab-generator.service';

describe('crontab generator service', () => {
  describe('getNextCronRuns', () => {
    const from = new Date('2026-09-22T00:00:00Z');

    it('returns the next executions in the given timezone', () => {
      const runs = getNextCronRuns({ expression: '0 9 * * 1-5', from, timezone: 'Asia/Taipei', count: 3 });

      expect(runs.map(d => d.toISOString())).toEqual([
        '2026-09-22T01:00:00.000Z',
        '2026-09-23T01:00:00.000Z',
        '2026-09-24T01:00:00.000Z',
      ]);
    });

    it('supports the optional seconds field', () => {
      const runs = getNextCronRuns({ expression: '*/20 * * * * *', from, timezone: 'UTC', count: 3 });

      expect(runs.map(d => d.toISOString())).toEqual([
        '2026-09-22T00:00:20.000Z',
        '2026-09-22T00:00:40.000Z',
        '2026-09-22T00:01:00.000Z',
      ]);
    });

    it('supports predefined aliases', () => {
      const runs = getNextCronRuns({ expression: '@daily', from, timezone: 'UTC', count: 2 });

      expect(runs.map(d => d.toISOString())).toEqual([
        '2026-09-23T00:00:00.000Z',
        '2026-09-24T00:00:00.000Z',
      ]);
    });

    it('returns nothing for @reboot and empty expressions', () => {
      expect(getNextCronRuns({ expression: '@reboot', from })).toEqual([]);
      expect(getNextCronRuns({ expression: '   ', from })).toEqual([]);
    });

    it('throws on an invalid expression', () => {
      expect(() => getNextCronRuns({ expression: '99 * * * *', from })).toThrow();
    });
  });
});
