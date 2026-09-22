<script setup lang="ts">
import {
  formatRFC7231,
  fromUnixTime,
  getTime,
  getUnixTime,
  isDate,
  isValid,
  parseJSON,
} from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import type { DateFormat, ToDateMapper } from './date-time-converter.types';
import {
  dateToExcelFormat,
  excelFormatToDate,
  isExcelFormat,
  isISO8601DateTimeString,
  isISO9075DateString,
  isMongoObjectId,
  isRFC3339DateString,
  isRFC7231DateString,
  isTimestamp,
  isUTCDateString,
  isUnixTimestamp,
} from './date-time-converter.models';
import { withDefaultOnError } from '@/utils/defaults';
import { useValidation } from '@/composable/validation';
import { useToolInput } from '@/composable/toolInput';
import { getBrowserTimezone, getTimezones } from '@/utils/timezones';

const { t } = useI18n();

const inputDate = ref('');
useToolInput(inputDate, { example: '2026-09-21T10:30:00Z' });

const timezone = ref(getBrowserTimezone());
const timezoneOptions = getTimezones().map(value => ({ label: value, value }));

const toDate: ToDateMapper = date => new Date(date);
// Strings without an explicit offset are interpreted in the selected timezone.
const toDateInTimezone: ToDateMapper = date => zonedTimeToUtc(date, timezone.value);
const inTimezone = (pattern: string) => (date: Date) => formatInTimeZone(date, timezone.value, pattern);

const formats: DateFormat[] = [
  {
    name: 'JS locale date string',
    fromDate: inTimezone('EEE MMM dd yyyy HH:mm:ss \'GMT\'xx (zzzz)'),
    toDate,
    formatMatcher: () => false,
  },
  {
    name: 'ISO 8601',
    fromDate: inTimezone('yyyy-MM-dd\'T\'HH:mm:ssXXX'),
    toDate: toDateInTimezone,
    formatMatcher: date => isISO8601DateTimeString(date),
  },
  {
    name: 'ISO 9075',
    fromDate: inTimezone('yyyy-MM-dd HH:mm:ss'),
    toDate: toDateInTimezone,
    formatMatcher: date => isISO9075DateString(date),
  },
  {
    name: 'RFC 3339',
    fromDate: inTimezone('yyyy-MM-dd\'T\'HH:mm:ssXXX'),
    toDate: toDateInTimezone,
    formatMatcher: date => isRFC3339DateString(date),
  },
  {
    name: 'RFC 7231',
    fromDate: formatRFC7231,
    toDate,
    formatMatcher: date => isRFC7231DateString(date),
  },
  {
    name: 'Unix timestamp',
    fromDate: date => String(getUnixTime(date)),
    toDate: sec => fromUnixTime(+sec),
    formatMatcher: date => isUnixTimestamp(date),
  },
  {
    name: 'Timestamp',
    fromDate: date => String(getTime(date)),
    toDate: ms => parseJSON(+ms),
    formatMatcher: date => isTimestamp(date),
  },
  {
    name: 'UTC format',
    fromDate: date => date.toUTCString(),
    toDate,
    formatMatcher: date => isUTCDateString(date),
  },
  {
    name: 'Mongo ObjectID',
    fromDate: date => `${Math.floor(date.getTime() / 1000).toString(16)}0000000000000000`,
    toDate: objectId => new Date(Number.parseInt(objectId.substring(0, 8), 16) * 1000),
    formatMatcher: date => isMongoObjectId(date),
  },
  {
    name: 'Excel date/time',
    fromDate: date => dateToExcelFormat(date),
    toDate: excelFormatToDate,
    formatMatcher: isExcelFormat,
  },
];

const formatIndex = ref(6);
const now = useNow();

const normalizedDate = computed(() => {
  if (!inputDate.value) {
    return now.value;
  }

  const { toDate } = formats[formatIndex.value];

  try {
    return toDate(inputDate.value);
  }
  catch (_ignored) {
    return undefined;
  }
});

function onDateInputChanged(value: string) {
  const matchingIndex = formats.findIndex(({ formatMatcher }) => formatMatcher(value));
  if (matchingIndex !== -1) {
    formatIndex.value = matchingIndex;
  }
}

const validation = useValidation({
  source: inputDate,
  watch: [formatIndex, timezone],
  rules: [
    {
      message: 'This date is invalid for this format',
      validator: value =>
        withDefaultOnError(() => {
          if (value === '') {
            return true;
          }

          const maybeDate = formats[formatIndex.value].toDate(value);
          return isDate(maybeDate) && isValid(maybeDate);
        }, false),
    },
  ],
});

function formatDateUsingFormatter(formatter: (date: Date) => string, date?: Date) {
  if (!date || !validation.isValid) {
    return '';
  }

  return withDefaultOnError(() => formatter(date), '');
}
</script>

<template>
  <div>
    <div flex gap-2>
      <c-input-text
        v-model:value="inputDate"
        autofocus
        placeholder="Put your date string here..."
        clearable
        test-id="date-time-converter-input"
        :validation="validation"
        @update:value="onDateInputChanged"
      />

      <c-select
        v-model:value="formatIndex"
        style="flex: 0 0 170px"
        :options="formats.map(({ name }, i) => ({ label: name, value: i }))"
        data-test-id="date-time-converter-format-select"
      />
    </div>

    <c-select
      v-model:value="timezone"
      searchable
      :label="t('tools.date-converter.timezone')"
      label-position="left"
      label-width="110px"
      :options="timezoneOptions"
      mt-3
      data-test-id="date-time-converter-timezone"
    />

    <n-divider />

    <input-copyable
      v-for="{ name, fromDate } in formats"
      :key="name"
      :label="name"
      label-width="150px"
      label-position="left"
      label-align="right"
      :value="formatDateUsingFormatter(fromDate, normalizedDate)"
      placeholder="Invalid date..."
      :test-id="name"
      readonly
      mt-2
    />
  </div>
</template>
