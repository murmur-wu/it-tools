export const timestampUnits = ['seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const;
export type TimestampUnit = typeof timestampUnits[number];

/** How many milliseconds one unit is worth. */
const millisecondsPerUnit: Record<TimestampUnit, number> = {
  seconds: 1e3,
  milliseconds: 1,
  microseconds: 1e-3,
  nanoseconds: 1e-6,
};

export interface ParsedTimestamp {
  raw: string
  date?: Date
  unit?: TimestampUnit
  error?: 'notANumber' | 'outOfRange'
}

/**
 * Guesses the unit from the digit count. A 10-digit value is seconds, 13 is milliseconds,
 * and so on, which covers every timestamp between 1973 and 5138.
 */
export function detectTimestampUnit(value: string): TimestampUnit {
  const digits = value.replace(/^[+-]/, '').replace(/\..*$/, '').length;

  if (digits <= 11) {
    return 'seconds';
  }
  if (digits <= 14) {
    return 'milliseconds';
  }
  if (digits <= 17) {
    return 'microseconds';
  }

  return 'nanoseconds';
}

export function parseTimestamp(raw: string, { unit = 'auto' }: { unit?: TimestampUnit | 'auto' } = {}): ParsedTimestamp {
  const value = raw.trim();

  if (!/^[+-]?\d+(\.\d+)?$/.test(value)) {
    return { raw, error: 'notANumber' };
  }

  const resolvedUnit = unit === 'auto' ? detectTimestampUnit(value) : unit;
  const milliseconds = Number(value) * millisecondsPerUnit[resolvedUnit];
  const date = new Date(milliseconds);

  if (Number.isNaN(date.getTime())) {
    return { raw, unit: resolvedUnit, error: 'outOfRange' };
  }

  return { raw, date, unit: resolvedUnit };
}

export function parseTimestamps(text: string, { unit = 'auto' }: { unit?: TimestampUnit | 'auto' } = {}): ParsedTimestamp[] {
  return text
    .split(/[\n,;\t]+/)
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(line => parseTimestamp(line, { unit }));
}
