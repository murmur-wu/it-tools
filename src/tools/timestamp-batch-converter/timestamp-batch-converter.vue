<script setup lang="ts">
import { formatInTimeZone } from 'date-fns-tz';
import { type TimestampUnit, parseTimestamps, timestampUnits } from './timestamp-batch-converter.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useToolInput, useToolOutput } from '@/composable/toolInput';
import { getBrowserTimezone, getTimezones } from '@/utils/timezones';

const { t } = useI18n();

const input = ref('');
useToolInput(input, { example: '1700000000\n1700000000000\n1609459200' });

const unit = ref<TimestampUnit | 'auto'>('auto');
const timezone = ref(getBrowserTimezone());
const timezoneOptions = getTimezones().map(value => ({ label: value, value }));

const patterns = [
  { key: 'iso8601', pattern: 'yyyy-MM-dd\'T\'HH:mm:ssXXX' },
  { key: 'iso9075', pattern: 'yyyy-MM-dd HH:mm:ss' },
  { key: 'dateOnly', pattern: 'yyyy-MM-dd' },
  { key: 'timeOnly', pattern: 'HH:mm:ss' },
  { key: 'verbose', pattern: 'yyyy-MM-dd HH:mm:ss (EEE) zzz' },
] as const;

const patternKey = ref<typeof patterns[number]['key']>('iso8601');
const pattern = computed(() => patterns.find(({ key }) => key === patternKey.value)?.pattern ?? patterns[0].pattern);

const rows = computed(() =>
  parseTimestamps(input.value, { unit: unit.value }).map((result, index) => ({
    index,
    raw: result.raw,
    unit: result.unit,
    error: result.error ? t(`tools.timestamp-batch-converter.errors.${result.error}`) : '',
    formatted: result.date ? formatInTimeZone(result.date, timezone.value, pattern.value) : '',
    iso: result.date?.toISOString() ?? '',
  })),
);

const output = computed(() => rows.value.map(row => row.formatted || row.error).join('\n'));
useToolOutput(output);

const validCount = computed(() => rows.value.filter(row => !row.error).length);
</script>

<template>
  <div>
    <c-card>
      <c-input-text
        v-model:value="input"
        :label="t('tools.timestamp-batch-converter.input')"
        :placeholder="t('tools.timestamp-batch-converter.inputPlaceholder')"
        multiline
        raw-text
        rows="6"
        autosize
        monospace
        mb-4
        test-id="timestamp-batch-input"
      />

      <div grid gap-3 md:grid-cols-2>
        <c-select
          v-model:value="unit"
          :label="t('tools.timestamp-batch-converter.unit')"
          label-position="left"
          label-width="110px"
          :options="[
            { label: t('tools.timestamp-batch-converter.units.auto'), value: 'auto' },
            ...timestampUnits.map((value) => ({ label: t(`tools.timestamp-batch-converter.units.${value}`), value })),
          ]"
          data-test-id="timestamp-batch-unit"
        />

        <c-select
          v-model:value="patternKey"
          :label="t('tools.timestamp-batch-converter.format')"
          label-position="left"
          label-width="110px"
          :options="patterns.map(({ key }) => ({ label: t(`tools.timestamp-batch-converter.formats.${key}`), value: key }))"
          data-test-id="timestamp-batch-format"
        />
      </div>

      <c-select
        v-model:value="timezone"
        searchable
        :label="t('tools.timestamp-batch-converter.timezone')"
        label-position="left"
        label-width="110px"
        :options="timezoneOptions"
        mt-3
        data-test-id="timestamp-batch-timezone"
      />
    </c-card>

    <c-card v-if="rows.length > 0" :title="t('tools.timestamp-batch-converter.result', { valid: validCount, total: rows.length })" mt-5>
      <n-scrollbar x-scrollable>
        <n-table :bordered="false" size="small" data-test-id="timestamp-batch-table">
          <thead>
            <tr>
              <th>{{ t('tools.timestamp-batch-converter.columns.input') }}</th>
              <th>{{ t('tools.timestamp-batch-converter.columns.unit') }}</th>
              <th>{{ t('tools.timestamp-batch-converter.columns.result', { timezone }) }}</th>
              <th>UTC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.index">
              <td font-mono>
                {{ row.raw }}
              </td>
              <td op-70>
                {{ row.unit ? t(`tools.timestamp-batch-converter.units.${row.unit}`) : '—' }}
              </td>
              <td font-mono>
                <span v-if="row.error" text-red-500>{{ row.error }}</span>
                <span v-else>{{ row.formatted }}</span>
              </td>
              <td font-mono op-70>
                {{ row.iso || '—' }}
              </td>
            </tr>
          </tbody>
        </n-table>
      </n-scrollbar>
    </c-card>

    <c-card v-if="output" :title="t('tools.timestamp-batch-converter.output')" mt-5>
      <TextareaCopyable :value="output" />
    </c-card>
  </div>
</template>
