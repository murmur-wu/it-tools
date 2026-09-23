import { parseExpression } from 'cron-parser';

export function getNextCronRuns({
  expression,
  count = 5,
  from = new Date(),
  timezone,
}: {
  expression: string
  count?: number
  from?: Date
  timezone?: string
}): Date[] {
  const trimmed = expression.trim();

  if (trimmed === '' || trimmed === '@reboot') {
    return [];
  }

  const iterator = parseExpression(trimmed, { currentDate: from, tz: timezone });
  const runs: Date[] = [];

  for (let i = 0; i < count; i++) {
    if (!iterator.hasNext()) {
      break;
    }

    runs.push(iterator.next().toDate());
  }

  return runs;
}
