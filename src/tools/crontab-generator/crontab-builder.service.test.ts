import { describe, expect, it } from 'vitest';
import { buildCronExpression } from './crontab-builder.service';

describe('crontab builder service', () => {
  describe('buildCronExpression', () => {
    it('builds every-N-minutes expressions', () => {
      expect(buildCronExpression({ frequency: 'minutely', everyMinutes: 1 })).toBe('* * * * *');
      expect(buildCronExpression({ frequency: 'minutely', everyMinutes: 15 })).toBe('*/15 * * * *');
    });

    it('builds hourly, daily, weekly, monthly and yearly expressions', () => {
      expect(buildCronExpression({ frequency: 'hourly', minute: 30 })).toBe('30 * * * *');
      expect(buildCronExpression({ frequency: 'daily', minute: 5, hour: 9 })).toBe('5 9 * * *');
      expect(buildCronExpression({ frequency: 'weekly', minute: 0, hour: 8, dayOfWeek: 1 })).toBe('0 8 * * 1');
      expect(buildCronExpression({ frequency: 'monthly', minute: 0, hour: 3, dayOfMonth: 15 })).toBe('0 3 15 * *');
      expect(buildCronExpression({ frequency: 'yearly', minute: 0, hour: 0, dayOfMonth: 1, month: 1 })).toBe('0 0 1 1 *');
    });

    it('falls back to sane defaults for missing fields', () => {
      expect(buildCronExpression({ frequency: 'daily' })).toBe('0 0 * * *');
      expect(buildCronExpression({ frequency: 'weekly' })).toBe('0 0 * * 1');
      expect(buildCronExpression({ frequency: 'minutely' })).toBe('* * * * *');
    });

    it('clamps out-of-range values instead of emitting an invalid expression', () => {
      expect(buildCronExpression({ frequency: 'daily', minute: 99, hour: -4 })).toBe('59 0 * * *');
      expect(buildCronExpression({ frequency: 'minutely', everyMinutes: 500 })).toBe('*/59 * * * *');
      expect(buildCronExpression({ frequency: 'monthly', dayOfMonth: 0 })).toBe('0 0 1 * *');
      expect(buildCronExpression({ frequency: 'yearly', month: 42 })).toBe('0 0 1 12 *');
    });
  });
});
