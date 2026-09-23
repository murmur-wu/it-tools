const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  catch {
    return 'UTC';
  }
}

export function getTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  let zones: string[] = FALLBACK_TIMEZONES;

  try {
    if (typeof intl.supportedValuesOf === 'function') {
      zones = intl.supportedValuesOf('timeZone');
    }
  }
  catch {
    zones = FALLBACK_TIMEZONES;
  }

  const browserTimezone = getBrowserTimezone();

  return Array.from(new Set(['UTC', browserTimezone, ...zones]));
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  }
  catch {
    return false;
  }
}
