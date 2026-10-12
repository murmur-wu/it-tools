<script setup lang="ts">
import {
  type CountResult,
  type ExcludedSummary,
  type Exclusions,
  type ShiftResult,
  type Weekday,
  countDays,
  getCalendarDifference,
  isIsoDate,
  shiftDate,
  toDayNumber,
  weekdays,
} from './date-calculator.service';
import { taiwanHolidayYears } from './taiwan-holidays.data';
import { useToolOutput, useToolRun } from '@/composable/toolInput';

const { t, locale } = useI18n();

type Mode = 'count' | 'add' | 'subtract';

const mode = ref<Mode>('count');
const startDate = ref<string | null>(null);
const endDate = ref<string | null>(null);
const amount = ref<number | null>(30);

// Settings are remembered between visits, like most tools on the site
const includeEnd = useStorage('date-calculator:include-end', false);
const excludedWeekdays = useStorage<Weekday[]>('date-calculator:excluded-weekdays', []);
const excludeHolidays = useStorage('date-calculator:exclude-holidays', false);
const isSettingsOpen = useStorage('date-calculator:settings-open', true);

const exclusions = computed<Exclusions>(() => ({ weekdays: excludedWeekdays.value, holidays: excludeHolidays.value }));
const allWeekdaysExcluded = computed(() => weekdays.every(weekday => excludedWeekdays.value.includes(weekday)));

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function useWorkdays() {
  excludedWeekdays.value = [6, 0];
  excludeHolidays.value = true;
}

function clearExclusions() {
  excludedWeekdays.value = [];
  excludeHolidays.value = false;
}

// Results appear once "Calculate" is pressed, then follow any change to the inputs
const calculatedModes = ref(new Set<Mode>());
function calculate() {
  calculatedModes.value = new Set([...calculatedModes.value, mode.value]);
}
useToolRun(calculate);

const isCalculated = computed(() => calculatedModes.value.has(mode.value));

const inputError = computed<string | null>(() => {
  if (!startDate.value || !isIsoDate(startDate.value)) {
    return t('tools.date-calculator.errors.startDate');
  }
  if (mode.value === 'count' && (!endDate.value || !isIsoDate(endDate.value))) {
    return t('tools.date-calculator.errors.endDate');
  }
  if (mode.value !== 'count' && (amount.value === null || amount.value < 0)) {
    return t('tools.date-calculator.errors.amount');
  }
  if (mode.value !== 'count' && allWeekdaysExcluded.value) {
    return t('tools.date-calculator.errors.allExcluded');
  }
  return null;
});

const countResult = computed<CountResult | null>(() => {
  if (mode.value !== 'count' || inputError.value || !startDate.value || !endDate.value) {
    return null;
  }
  return countDays({ start: startDate.value, end: endDate.value, includeEnd: includeEnd.value, exclusions: exclusions.value });
});

const shiftResult = computed<ShiftResult | null>(() => {
  if (mode.value === 'count' || inputError.value || !startDate.value || amount.value === null) {
    return null;
  }
  return shiftDate({ start: startDate.value, days: amount.value, direction: mode.value === 'add' ? 1 : -1, exclusions: exclusions.value });
});

const calendarDifference = computed(() => {
  if (!startDate.value || !endDate.value || !isIsoDate(startDate.value) || !isIsoDate(endDate.value)) {
    return null;
  }
  return getCalendarDifference(startDate.value, endDate.value);
});

// "1 year 2 months 5 days", leaving out zero units ("18 days" rather than "0 years 0 months 18 days")
const calendarDifferenceText = computed(() => {
  const difference = calendarDifference.value;
  if (!difference) {
    return '';
  }
  const parts = (['years', 'months', 'days'] as const)
    .filter(unit => difference[unit] > 0)
    .map(unit => t(`tools.date-calculator.result.units.${unit}`, { count: difference[unit] }));
  return parts.length > 0 ? parts.join(t('tools.date-calculator.result.unitSeparator')) : t('tools.date-calculator.result.units.days', { count: 0 });
});

const hasExclusions = computed(() => excludedWeekdays.value.length > 0 || excludeHolidays.value);

const intlLocale = computed(() => ({ 'zh-TW': 'zh-TW', 'zh': 'zh-CN' } as Record<string, string>)[locale.value] ?? locale.value);

function formatDate(isoDate: string, style: 'full' | 'short' = 'full') {
  const date = new Date(toDayNumber(isoDate) * 86_400_000);
  const options: Intl.DateTimeFormatOptions = style === 'full'
    ? { dateStyle: 'full', timeZone: 'UTC' }
    : { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(intlLocale.value, options).format(date);
}

const weekdayKeys: Record<Weekday, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

function weekdayLabel(weekday: Weekday) {
  return t(`tools.date-calculator.weekdays.${weekdayKeys[weekday]}`);
}

function describeExcluded(summary: ExcludedSummary): string {
  const parts = weekdays
    .filter(weekday => summary.byWeekday[weekday])
    .map(weekday => t('tools.date-calculator.result.excludedWeekday', { weekday: weekdayLabel(weekday), count: summary.byWeekday[weekday] }));
  if (summary.holidays.length > 0) {
    parts.push(t('tools.date-calculator.result.excludedHolidays', { count: summary.holidays.length }));
  }
  return parts.join(t('tools.date-calculator.result.separator'));
}

const missingHolidayYears = computed(() => (countResult.value ?? shiftResult.value)?.missingHolidayYears ?? []);
const excludedSummary = computed(() => (countResult.value ?? shiftResult.value)?.excluded ?? null);

useToolOutput(() => {
  if (!isCalculated.value) {
    return '';
  }
  if (countResult.value) {
    return String(countResult.value.days);
  }
  return shiftResult.value?.date ?? '';
});
</script>

<template>
  <div>
    <n-tabs v-model:value="mode" type="line" justify-content="space-evenly" size="large" animated data-test-id="date-calculator-mode">
      <n-tab name="count">
        {{ t('tools.date-calculator.modes.count') }}
      </n-tab>
      <n-tab name="add">
        {{ t('tools.date-calculator.modes.add') }}
      </n-tab>
      <n-tab name="subtract">
        {{ t('tools.date-calculator.modes.subtract') }}
      </n-tab>
    </n-tabs>

    <div mt-5 flex flex-col gap-4>
      <div>
        <div mb-1 flex items-center justify-between text-sm>
          <label op-80>{{ t('tools.date-calculator.startDate') }}</label>
          <a href="#" class="text-primary" data-test-id="date-calculator-start-today" @click.prevent="startDate = today()">{{ t('tools.date-calculator.today') }}</a>
        </div>
        <n-date-picker
          v-model:formatted-value="startDate"
          value-format="yyyy-MM-dd"
          type="date"
          clearable
          w-full
          :placeholder="t('tools.date-calculator.pickDate')"
          data-test-id="date-calculator-start"
        />
      </div>

      <div v-if="mode === 'count'">
        <div mb-1 flex items-center justify-between text-sm>
          <label op-80>{{ t('tools.date-calculator.endDate') }}</label>
          <a href="#" class="text-primary" data-test-id="date-calculator-end-today" @click.prevent="endDate = today()">{{ t('tools.date-calculator.today') }}</a>
        </div>
        <n-date-picker
          v-model:formatted-value="endDate"
          value-format="yyyy-MM-dd"
          type="date"
          clearable
          w-full
          :placeholder="t('tools.date-calculator.pickDate')"
          data-test-id="date-calculator-end"
        />
      </div>

      <div v-else>
        <div mb-1 text-sm op-80>
          {{ t(mode === 'add' ? 'tools.date-calculator.daysToAdd' : 'tools.date-calculator.daysToSubtract') }}
        </div>
        <n-input-number v-model:value="amount" :min="0" :max="100000" :precision="0" w-full data-test-id="date-calculator-amount" />
      </div>

      <c-card>
        <div flex cursor-pointer select-none items-center justify-between @click="isSettingsOpen = !isSettingsOpen">
          <span font-bold>{{ t('tools.date-calculator.settings') }}</span>
          <span text-lg op-70>{{ isSettingsOpen ? '−' : '+' }}</span>
        </div>

        <div v-if="isSettingsOpen" mt-4>
          <n-checkbox v-if="mode === 'count'" v-model:checked="includeEnd" mb-4 data-test-id="date-calculator-include-end">
            {{ t('tools.date-calculator.includeEnd') }}
          </n-checkbox>

          <div mb-2 flex flex-wrap items-center justify-between gap-2>
            <span font-bold>{{ t('tools.date-calculator.exclude') }}</span>
            <span text-sm>
              <a href="#" class="text-primary" data-test-id="date-calculator-workdays" @click.prevent="useWorkdays">{{ t('tools.date-calculator.workdaysPreset') }}</a>
              <template v-if="hasExclusions">
                ·
                <a href="#" class="text-primary" @click.prevent="clearExclusions">{{ t('tools.date-calculator.clearExclusions') }}</a>
              </template>
            </span>
          </div>
          <n-checkbox-group v-model:value="excludedWeekdays" data-test-id="date-calculator-weekdays">
            <div flex flex-wrap gap-x-3 gap-y-2>
              <n-checkbox v-for="weekday in weekdays" :key="weekday" :value="weekday" :label="weekdayLabel(weekday)" />
            </div>
          </n-checkbox-group>

          <n-divider my-4 />

          <n-checkbox v-model:checked="excludeHolidays" data-test-id="date-calculator-holidays">
            {{ t('tools.date-calculator.excludeHolidays') }}
          </n-checkbox>
          <div mt-1 text-xs op-60>
            {{ t('tools.date-calculator.holidaysHint', { first: taiwanHolidayYears.first, last: taiwanHolidayYears.last }) }}
          </div>
        </div>
      </c-card>

      <c-button type="primary" size="large" w-full data-test-id="date-calculator-calculate" @click="calculate">
        {{ t('tools.date-calculator.calculate') }}
      </c-button>

      <template v-if="isCalculated">
        <n-alert v-if="inputError" type="warning" data-test-id="date-calculator-error">
          {{ inputError }}
        </n-alert>

        <c-card v-else data-test-id="date-calculator-result">
          <template v-if="countResult">
            <div text-sm op-70>
              {{ hasExclusions ? t('tools.date-calculator.result.countedDays') : t('tools.date-calculator.result.days') }}
            </div>
            <div text-4xl font-bold data-test-id="date-calculator-days">
              {{ t('tools.date-calculator.result.daysValue', { count: countResult.days }) }}
            </div>

            <ul mb-0 mt-3 pl-5 text-sm op-90>
              <li v-if="countResult.reversed">
                {{ t('tools.date-calculator.result.reversed') }}
              </li>
              <li v-if="hasExclusions">
                {{ t('tools.date-calculator.result.calendarDays', { count: Math.abs(countResult.calendarDays) }) }}<template v-if="countResult.excluded.total > 0">
                  {{ t('tools.date-calculator.result.excludedPrefix', { count: countResult.excluded.total }) }}{{ describeExcluded(countResult.excluded) }}
                </template>
              </li>
              <li v-if="Math.abs(countResult.days) >= 7">
                {{ t('tools.date-calculator.result.weeks', { weeks: Math.floor(Math.abs(countResult.days) / 7), days: Math.abs(countResult.days) % 7 }) }}
              </li>
              <li v-if="calendarDifferenceText">
                {{ t('tools.date-calculator.result.calendarDifference', { value: calendarDifferenceText }) }}
              </li>
            </ul>
          </template>

          <template v-else-if="shiftResult">
            <div text-sm op-70>
              {{ t('tools.date-calculator.result.date') }}
            </div>
            <div text-3xl font-bold data-test-id="date-calculator-date">
              {{ formatDate(shiftResult.date) }}
            </div>
            <div mt-1 text-sm op-70>
              {{ shiftResult.date }}
            </div>

            <ul mb-0 mt-3 pl-5 text-sm op-90>
              <li>
                {{ t(mode === 'add' ? 'tools.date-calculator.result.shiftedAfter' : 'tools.date-calculator.result.shiftedBefore', { count: amount ?? 0, calendarDays: shiftResult.calendarDays }) }}
              </li>
              <li v-if="shiftResult.excluded.total > 0">
                {{ t('tools.date-calculator.result.skippedPrefix', { count: shiftResult.excluded.total }) }}{{ describeExcluded(shiftResult.excluded) }}
              </li>
            </ul>
          </template>

          <div v-if="excludedSummary && excludedSummary.holidays.length > 0" mt-4 data-test-id="date-calculator-holidays-list">
            <div mb-1 text-sm font-bold>
              {{ t('tools.date-calculator.result.holidaysInRange') }}
            </div>
            <div flex flex-wrap gap-2>
              <n-tag v-for="holiday in excludedSummary.holidays" :key="holiday.date" size="small">
                {{ formatDate(holiday.date, 'short') }} {{ holiday.name }}
              </n-tag>
            </div>
          </div>

          <n-alert v-if="missingHolidayYears.length > 0" type="warning" mt-4>
            {{ t('tools.date-calculator.result.missingHolidayYears', { years: missingHolidayYears.join(', '), first: taiwanHolidayYears.first, last: taiwanHolidayYears.last }) }}
          </n-alert>
        </c-card>
      </template>
    </div>
  </div>
</template>
