export const cronFrequencies = ['minutely', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type CronFrequency = typeof cronFrequencies[number];

export interface CronSpec {
  frequency: CronFrequency
  /** Run every N minutes, used by the "minutely" frequency. */
  everyMinutes?: number
  minute?: number
  hour?: number
  /** 0 = Sunday, used by the "weekly" frequency. */
  dayOfWeek?: number
  dayOfMonth?: number
  month?: number
}

function clamp(value: number | undefined, { min, max, fallback }: { min: number; max: number; fallback: number }): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function buildCronExpression(spec: CronSpec): string {
  const minute = clamp(spec.minute, { min: 0, max: 59, fallback: 0 });
  const hour = clamp(spec.hour, { min: 0, max: 23, fallback: 0 });
  const dayOfMonth = clamp(spec.dayOfMonth, { min: 1, max: 31, fallback: 1 });
  const dayOfWeek = clamp(spec.dayOfWeek, { min: 0, max: 6, fallback: 1 });
  const month = clamp(spec.month, { min: 1, max: 12, fallback: 1 });

  switch (spec.frequency) {
    case 'minutely': {
      const step = clamp(spec.everyMinutes, { min: 1, max: 59, fallback: 1 });

      return `${step === 1 ? '*' : `*/${step}`} * * * *`;
    }
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    case 'yearly':
      return `${minute} ${hour} ${dayOfMonth} ${month} *`;
  }
}
