import { taiwanHolidayYears, taiwanHolidays, taiwanMakeupWorkdays } from './taiwan-holidays.data';

// Dates are handled as whole calendar days ("YYYY-MM-DD" strings, or day numbers counted from
// 1970-01-01), never as instants, so time zones and daylight saving time cannot shift a count.

export const weekdays = [1, 2, 3, 4, 5, 6, 0] as const; // Monday first, getUTCDay() numbering
export type Weekday = typeof weekdays[number];

export interface Exclusions {
  weekdays: Weekday[]
  holidays: boolean
}

const msPerDay = 86_400_000;
const makeupWorkdaySet = new Set(taiwanMakeupWorkdays);

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return toIsoDate(toDayNumber(value)) === value;
}

export function toDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / msPerDay);
}

export function toIsoDate(dayNumber: number): string {
  return new Date(dayNumber * msPerDay).toISOString().slice(0, 10);
}

export function weekdayOf(dayNumber: number): Weekday {
  return new Date(dayNumber * msPerDay).getUTCDay() as Weekday;
}

export function getHolidayName(isoDate: string): string | undefined {
  return taiwanHolidays[isoDate];
}

export function hasHolidayData(year: number): boolean {
  return year >= taiwanHolidayYears.first && year <= taiwanHolidayYears.last;
}

type DayStatus =
  | { excluded: false }
  | { excluded: true; reason: 'holiday'; name: string }
  | { excluded: true; reason: 'weekday'; weekday: Weekday };

function getDayStatus(dayNumber: number, exclusions: Exclusions): DayStatus {
  const isoDate = toIsoDate(dayNumber);

  if (exclusions.holidays) {
    const name = getHolidayName(isoDate);
    if (name) {
      return { excluded: true, reason: 'holiday', name };
    }
    // A Saturday the government declared a working day still counts when counting working days
    if (makeupWorkdaySet.has(isoDate)) {
      return { excluded: false };
    }
  }

  const weekday = weekdayOf(dayNumber);
  if (exclusions.weekdays.includes(weekday)) {
    return { excluded: true, reason: 'weekday', weekday };
  }

  return { excluded: false };
}

export interface ExcludedSummary {
  byWeekday: Partial<Record<Weekday, number>>
  holidays: { date: string; name: string }[]
  total: number
}

function emptySummary(): ExcludedSummary {
  return { byWeekday: {}, holidays: [], total: 0 };
}

function record(summary: ExcludedSummary, dayNumber: number, status: DayStatus) {
  if (!status.excluded) {
    return;
  }
  summary.total++;
  if (status.reason === 'holiday') {
    summary.holidays.push({ date: toIsoDate(dayNumber), name: status.name });
  }
  else {
    summary.byWeekday[status.weekday] = (summary.byWeekday[status.weekday] ?? 0) + 1;
  }
}

function yearsWithoutHolidayData(fromDay: number, toDay: number, exclusions: Exclusions): number[] {
  if (!exclusions.holidays) {
    return [];
  }

  const firstYear = Number(toIsoDate(Math.min(fromDay, toDay)).slice(0, 4));
  const lastYear = Number(toIsoDate(Math.max(fromDay, toDay)).slice(0, 4));
  const missing: number[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    if (!hasHolidayData(year)) {
      missing.push(year);
    }
  }
  return missing;
}

export function assertSomeDayCounts(exclusions: Exclusions) {
  if (weekdays.every(weekday => exclusions.weekdays.includes(weekday))) {
    throw new Error('All weekdays are excluded');
  }
}

export interface CountResult {
  // Days counted once exclusions are removed; negative when the end date is before the start date
  days: number
  calendarDays: number
  excluded: ExcludedSummary
  reversed: boolean
  missingHolidayYears: number[]
}

// Counts the days from start to end. The start date is counted and the end date is not, unless
// includeEnd is set, which matches "how many days between" in most calendars and spreadsheets.
export function countDays({ start, end, includeEnd, exclusions }: {
  start: string
  end: string
  includeEnd: boolean
  exclusions: Exclusions
}): CountResult {
  const startDay = toDayNumber(start);
  const endDay = toDayNumber(end);
  const reversed = endDay < startDay;
  const [from, to] = reversed ? [endDay, startDay] : [startDay, endDay];
  const last = includeEnd ? to : to - 1;

  const excluded = emptySummary();
  let counted = 0;
  for (let day = from; day <= last; day++) {
    const status = getDayStatus(day, exclusions);
    record(excluded, day, status);
    if (!status.excluded) {
      counted++;
    }
  }

  const calendarDays = Math.max(0, last - from + 1);

  return {
    days: reversed ? -counted : counted,
    calendarDays: reversed ? -calendarDays : calendarDays,
    excluded,
    reversed,
    missingHolidayYears: yearsWithoutHolidayData(from, to, exclusions),
  };
}

export interface ShiftResult {
  date: string
  calendarDays: number
  excluded: ExcludedSummary
  missingHolidayYears: number[]
}

// Moves from the start date by a number of counted days, skipping excluded days: adding 5 days
// with weekends excluded lands on the 5th working day after the start date.
export function shiftDate({ start, days, direction, exclusions }: {
  start: string
  days: number
  direction: 1 | -1
  exclusions: Exclusions
}): ShiftResult {
  assertSomeDayCounts(exclusions);

  const startDay = toDayNumber(start);
  const excluded = emptySummary();
  let day = startDay;
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    day += direction;
    const status = getDayStatus(day, exclusions);
    record(excluded, day, status);
    if (!status.excluded) {
      remaining--;
    }
  }

  // Walking backwards collects holidays latest first; list them in calendar order
  excluded.holidays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    date: toIsoDate(day),
    calendarDays: Math.abs(day - startDay),
    excluded,
    missingHolidayYears: yearsWithoutHolidayData(startDay, day, exclusions),
  };
}

// Adds whole months, keeping the day of month when possible (Jan 31 + 1 month = Feb 28 or 29)
function addMonths(isoDate: string, months: number): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return Math.floor(Date.UTC(year, month - 1 + months, Math.min(day, lastDayOfTargetMonth)) / msPerDay);
}

// Calendar difference as years, months and days, e.g. 2026-01-31 → 2026-03-01 is 1 month 1 day
export function getCalendarDifference(start: string, end: string): { years: number; months: number; days: number } {
  const [from, to] = toDayNumber(end) < toDayNumber(start) ? [end, start] : [start, end];
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  const toDay = toDayNumber(to);

  let months = (toYear - fromYear) * 12 + (toMonth - fromMonth);
  if (addMonths(from, months) > toDay) {
    months--;
  }

  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days: toDay - addMonths(from, months),
  };
}
