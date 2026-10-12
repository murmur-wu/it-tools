import { describe, expect, it } from 'vitest';
import {
  type Exclusions,
  countDays,
  getCalendarDifference,
  getHolidayName,
  hasHolidayData,
  isIsoDate,
  shiftDate,
  toDayNumber,
  toIsoDate,
} from './date-calculator.service';

const none: Exclusions = { weekdays: [], holidays: false };
const weekends: Exclusions = { weekdays: [6, 0], holidays: false };
// Saturdays, Sundays and Taiwan public holidays: the official working days
const workdays: Exclusions = { weekdays: [6, 0], holidays: true };

// Expected values were computed independently from the government calendar data
describe('date-calculator service', () => {
  describe('date helpers', () => {
    it('round-trips ISO dates through day numbers', () => {
      expect(toIsoDate(toDayNumber('2024-02-29'))).toBe('2024-02-29');
      expect(toDayNumber('1970-01-02')).toBe(1);
    });

    it('validates ISO dates', () => {
      expect(isIsoDate('2026-02-28')).toBe(true);
      expect(isIsoDate('2026-02-30')).toBe(false);
      expect(isIsoDate('2026-2-3')).toBe(false);
      expect(isIsoDate('')).toBe(false);
    });

    it('knows Taiwan public holidays and which years are covered', () => {
      expect(getHolidayName('2026-02-17')).toBe('春節');
      expect(getHolidayName('2026-10-10')).toBe('國慶日');
      expect(getHolidayName('2026-10-12')).toBeUndefined();
      expect(hasHolidayData(2026)).toBe(true);
      expect(hasHolidayData(2016)).toBe(false);
    });
  });

  describe('countDays', () => {
    it('counts the days between two dates, optionally including the end date', () => {
      expect(countDays({ start: '2026-01-01', end: '2026-01-31', includeEnd: false, exclusions: none }).days).toBe(30);
      expect(countDays({ start: '2026-01-01', end: '2026-01-31', includeEnd: true, exclusions: none }).days).toBe(31);
      expect(countDays({ start: '2026-03-01', end: '2026-03-01', includeEnd: false, exclusions: none }).days).toBe(0);
    });

    it('handles leap years', () => {
      expect(countDays({ start: '2024-02-01', end: '2024-03-01', includeEnd: false, exclusions: none }).days).toBe(29);
    });

    it('returns a negative count when the end date is before the start date', () => {
      const result = countDays({ start: '2026-01-31', end: '2026-01-01', includeEnd: false, exclusions: none });

      expect(result.reversed).toBe(true);
      expect(result.days).toBe(-30);
    });

    it('excludes weekdays and reports how many of each were removed', () => {
      const result = countDays({ start: '2026-10-01', end: '2026-10-31', includeEnd: true, exclusions: weekends });

      expect(result.days).toBe(22);
      expect(result.calendarDays).toBe(31);
      expect(result.excluded.byWeekday).toEqual({ 6: 5, 0: 4 });
      expect(result.excluded.total).toBe(9);
    });

    it('matches the official number of working days in a year', () => {
      expect(countDays({ start: '2026-01-01', end: '2026-12-31', includeEnd: true, exclusions: workdays }).days).toBe(245);
      expect(countDays({ start: '2025-01-01', end: '2025-12-31', includeEnd: true, exclusions: workdays }).days).toBe(247);
    });

    it('excludes the Lunar New Year holidays and lists them', () => {
      const result = countDays({ start: '2026-02-09', end: '2026-02-27', includeEnd: true, exclusions: workdays });

      expect(result.days).toBe(9);
      expect(result.excluded.holidays.map(holiday => holiday.date)).toEqual([
        '2026-02-15',
        '2026-02-16',
        '2026-02-17',
        '2026-02-18',
        '2026-02-19',
        '2026-02-20',
        '2026-02-27',
      ]);
    });

    it('counts a Saturday that is an official makeup workday', () => {
      // 2025-02-08 was a Saturday working day (補行上班)
      expect(countDays({ start: '2025-02-03', end: '2025-02-09', includeEnd: true, exclusions: workdays }).days).toBe(6);
      // Without the holiday option it is just another Saturday
      expect(countDays({ start: '2025-02-03', end: '2025-02-09', includeEnd: true, exclusions: weekends }).days).toBe(5);
    });

    it('flags years without holiday data instead of silently ignoring holidays', () => {
      expect(countDays({ start: '2027-12-01', end: '2028-01-31', includeEnd: true, exclusions: workdays }).missingHolidayYears).toEqual([2028]);
      expect(countDays({ start: '2027-12-01', end: '2028-01-31', includeEnd: true, exclusions: weekends }).missingHolidayYears).toEqual([]);
    });
  });

  describe('shiftDate', () => {
    it('adds and subtracts calendar days', () => {
      expect(shiftDate({ start: '2026-01-31', days: 30, direction: 1, exclusions: none }).date).toBe('2026-03-02');
      expect(shiftDate({ start: '2026-03-01', days: 1, direction: -1, exclusions: none }).date).toBe('2026-02-28');
      expect(shiftDate({ start: '2026-03-01', days: 0, direction: 1, exclusions: none }).date).toBe('2026-03-01');
    });

    it('adds working days across the Lunar New Year', () => {
      const result = shiftDate({ start: '2026-02-13', days: 5, direction: 1, exclusions: workdays });

      expect(result.date).toBe('2026-03-02');
      expect(result.calendarDays).toBe(17);
    });

    it('subtracts working days across the Lunar New Year, listing holidays in calendar order', () => {
      const result = shiftDate({ start: '2026-02-24', days: 5, direction: -1, exclusions: workdays });

      expect(result.date).toBe('2026-02-10');
      expect(result.excluded.holidays.map(holiday => holiday.date)).toEqual(['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20']);
    });

    it('skips the National Day long weekend', () => {
      expect(shiftDate({ start: '2026-10-08', days: 3, direction: 1, exclusions: workdays }).date).toBe('2026-10-14');
    });

    it('refuses to run when every weekday is excluded', () => {
      expect(() => shiftDate({ start: '2026-01-01', days: 1, direction: 1, exclusions: { weekdays: [0, 1, 2, 3, 4, 5, 6], holidays: false } }))
        .toThrow();
    });
  });

  describe('getCalendarDifference', () => {
    it('splits the difference into years, months and days', () => {
      expect(getCalendarDifference('2026-01-15', '2027-03-20')).toEqual({ years: 1, months: 2, days: 5 });
      expect(getCalendarDifference('2026-01-31', '2026-03-01')).toEqual({ years: 0, months: 1, days: 1 });
      expect(getCalendarDifference('2024-02-29', '2025-02-28')).toEqual({ years: 1, months: 0, days: 0 });
      expect(getCalendarDifference('2026-05-10', '2026-05-10')).toEqual({ years: 0, months: 0, days: 0 });
    });

    it('does not depend on the order of the dates', () => {
      expect(getCalendarDifference('2027-03-20', '2026-01-15')).toEqual({ years: 1, months: 2, days: 5 });
    });
  });
});
