<script setup lang="ts">
import cronstrue from 'cronstrue';
import { isValidCron } from 'cron-validator';
import { formatInTimeZone } from 'date-fns-tz';
import { getNextCronRuns } from './crontab-generator.service';
import { useStyleStore } from '@/stores/style.store';
import { useToolInput } from '@/composable/toolInput';
import { getBrowserTimezone, getTimezones } from '@/utils/timezones';

function isCronValid(v: string) {
  return isValidCron(v, { allowBlankDay: true, alias: true, seconds: true });
}

const styleStore = useStyleStore();
const { t } = useI18n();

const cron = ref('40 * * * *');
useToolInput(cron, { example: '0 9 * * 1-5' });

const timezone = ref(getBrowserTimezone());
const timezoneOptions = getTimezones().map(value => ({ label: value, value }));
const now = useNow({ interval: 30_000 });

const nextRuns = computed(() => {
  if (!isCronValid(cron.value)) {
    return [];
  }

  try {
    return getNextCronRuns({ expression: cron.value, count: 5, from: now.value, timezone: timezone.value })
      .map(date => ({
        key: date.getTime(),
        local: formatInTimeZone(date, timezone.value, 'yyyy-MM-dd HH:mm:ss (EEE)'),
        iso: date.toISOString(),
      }));
  }
  catch {
    return [];
  }
});

const isReboot = computed(() => cron.value.trim() === '@reboot');
const cronstrueConfig = reactive({
  verbose: true,
  dayOfWeekStartIndexZero: true,
  use24HourTimeFormat: true,
  throwExceptionOnParseError: true,
});

const helpers = [
  {
    symbol: '*',
    meaning: 'Any value',
    example: '* * * *',
    equivalent: 'Every minute',
  },
  {
    symbol: '-',
    meaning: 'Range of values',
    example: '1-10 * * *',
    equivalent: 'Minutes 1 through 10',
  },
  {
    symbol: ',',
    meaning: 'List of values',
    example: '1,10 * * *',
    equivalent: 'At minutes 1 and 10',
  },
  {
    symbol: '/',
    meaning: 'Step values',
    example: '*/10 * * *',
    equivalent: 'Every 10 minutes',
  },
  {
    symbol: '@yearly',
    meaning: 'Once every year at midnight of 1 January',
    example: '@yearly',
    equivalent: '0 0 1 1 *',
  },
  {
    symbol: '@annually',
    meaning: 'Same as @yearly',
    example: '@annually',
    equivalent: '0 0 1 1 *',
  },
  {
    symbol: '@monthly',
    meaning: 'Once a month at midnight on the first day',
    example: '@monthly',
    equivalent: '0 0 1 * *',
  },
  {
    symbol: '@weekly',
    meaning: 'Once a week at midnight on Sunday morning',
    example: '@weekly',
    equivalent: '0 0 * * 0',
  },
  {
    symbol: '@daily',
    meaning: 'Once a day at midnight',
    example: '@daily',
    equivalent: '0 0 * * *',
  },
  {
    symbol: '@midnight',
    meaning: 'Same as @daily',
    example: '@midnight',
    equivalent: '0 0 * * *',
  },
  {
    symbol: '@hourly',
    meaning: 'Once an hour at the beginning of the hour',
    example: '@hourly',
    equivalent: '0 * * * *',
  },
  {
    symbol: '@reboot',
    meaning: 'Run at startup',
    example: '',
    equivalent: '',
  },
];

const cronString = computed(() => {
  if (isCronValid(cron.value)) {
    return cronstrue.toString(cron.value, cronstrueConfig);
  }
  return ' ';
});

const cronValidationRules = [
  {
    validator: (value: string) => isCronValid(value),
    message: t('tools.crontab-generator.invalid'),
  },
];
</script>

<template>
  <c-card>
    <div mx-auto max-w-sm>
      <c-input-text
        v-model:value="cron"
        size="large"
        placeholder="* * * * *"
        :validation-rules="cronValidationRules"
        mb-3
      />
    </div>

    <div class="cron-string">
      {{ cronString }}
    </div>

    <n-divider />

    <div flex justify-center>
      <n-form :show-feedback="false" label-width="170" label-placement="left">
        <n-form-item :label="t('tools.crontab-generator.verbose')">
          <n-switch v-model:value="cronstrueConfig.verbose" />
        </n-form-item>
        <n-form-item :label="t('tools.crontab-generator.use24Hour')">
          <n-switch v-model:value="cronstrueConfig.use24HourTimeFormat" />
        </n-form-item>
        <n-form-item :label="t('tools.crontab-generator.daysStartAtZero')">
          <n-switch v-model:value="cronstrueConfig.dayOfWeekStartIndexZero" />
        </n-form-item>
      </n-form>
    </div>
  </c-card>

  <c-card :title="t('tools.crontab-generator.nextRuns')">
    <c-select
      v-model:value="timezone"
      searchable
      :label="t('tools.crontab-generator.timezone')"
      label-position="left"
      label-width="110px"
      :options="timezoneOptions"
      mb-4
      data-test-id="cron-timezone"
    />

    <div v-if="isReboot" op-70>
      {{ t('tools.crontab-generator.rebootHint') }}
    </div>
    <div v-else-if="nextRuns.length === 0" op-70>
      {{ t('tools.crontab-generator.noNextRuns') }}
    </div>
    <n-table v-else :bordered="false" size="small" data-test-id="cron-next-runs">
      <thead>
        <tr>
          <th w-10>
            #
          </th>
          <th>{{ t('tools.crontab-generator.runAt', { timezone }) }}</th>
          <th v-if="!styleStore.isSmallScreen">
            UTC
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(run, index) in nextRuns" :key="run.key">
          <td>{{ index + 1 }}</td>
          <td font-mono>
            {{ run.local }}
          </td>
          <td v-if="!styleStore.isSmallScreen" font-mono op-70>
            {{ run.iso }}
          </td>
        </tr>
      </tbody>
    </n-table>
  </c-card>
  <c-card>
    <pre>
┌──────────── [optional] seconds (0 - 59)
| ┌────────── minute (0 - 59)
| | ┌──────── hour (0 - 23)
| | | ┌────── day of month (1 - 31)
| | | | ┌──── month (1 - 12) OR jan,feb,mar,apr ...
| | | | | ┌── day of week (0 - 6, sunday=0) OR sun,mon ...
| | | | | |
* * * * * * command</pre>

    <div v-if="styleStore.isSmallScreen">
      <c-card v-for="{ symbol, meaning, example, equivalent } in helpers" :key="symbol" mb-3 important:border-none>
        <div>
          Symbol: <strong>{{ symbol }}</strong>
        </div>
        <div>
          Meaning: <strong>{{ meaning }}</strong>
        </div>
        <div>
          Example:
          <strong><code>{{ example }}</code></strong>
        </div>
        <div>
          Equivalent: <strong>{{ equivalent }}</strong>
        </div>
      </c-card>
    </div>

    <c-table v-else :data="helpers" />
  </c-card>
</template>

<style lang="less" scoped>
::v-deep(input) {
  font-size: 30px;
  font-family: monospace;
  padding: 5px;
  text-align: center;
}

.cron-string {
  text-align: center;
  font-size: 22px;
  opacity: 0.8;
  margin: 5px 0 15px;
}

pre {
  overflow: auto;
  padding: 10px 0;
}
</style>
