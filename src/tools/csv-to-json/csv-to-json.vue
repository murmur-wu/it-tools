<script setup lang="ts">
import { type Delimiter, csvToJson } from './csv-to-json.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useToolInput, useToolOutput } from '@/composable/toolInput';

const { t } = useI18n();

const example = 'name,age,city\nJohn,42,"Taipei, Taiwan"\nJane,37,Tokyo';

const input = ref('');
useToolInput(input, { example });

const delimiter = ref<Delimiter | 'auto'>('auto');
const hasHeader = ref(true);
const inferTypes = ref(true);
const trimValues = ref(false);
const indent = ref(2);

const result = computed(() => {
  try {
    return {
      ...csvToJson(input.value, {
        delimiter: delimiter.value,
        hasHeader: hasHeader.value,
        inferTypes: inferTypes.value,
        trimValues: trimValues.value,
      }),
      error: '',
    };
  }
  catch (error: unknown) {
    return { headers: [], rows: [], data: [], error: (error as Error).message };
  }
});

const output = computed(() => (result.value.data.length === 0 ? '' : JSON.stringify(result.value.data, null, indent.value)));
useToolOutput(output);

const previewRows = computed(() => result.value.rows.slice(0, 20));
const previewHeaders = computed(() =>
  result.value.headers.length > 0
    ? result.value.headers
    : Array.from({ length: result.value.rows[0]?.length ?? 0 }, (_, index) => String(index + 1)),
);
</script>

<template>
  <div>
    <c-card>
      <c-input-text
        v-model:value="input"
        :label="t('tools.csv-to-json.input')"
        :placeholder="t('tools.csv-to-json.inputPlaceholder')"

        rows="6"

        raw-text autosize multiline monospace mb-4
        test-id="csv-to-json-input"
      />

      <div grid gap-3 md:grid-cols-2>
        <c-select
          v-model:value="delimiter"
          :label="t('tools.csv-to-json.delimiter')"
          label-position="left"
          label-width="110px"
          :options="[
            { label: t('tools.csv-to-json.autoDetect'), value: 'auto' },
            { label: t('tools.csv-to-json.comma'), value: ',' },
            { label: t('tools.csv-to-json.semicolon'), value: ';' },
            { label: t('tools.csv-to-json.tab'), value: '\t' },
            { label: t('tools.csv-to-json.pipe'), value: '|' },
          ]"
          data-test-id="csv-to-json-delimiter"
        />

        <n-form-item :label="t('tools.csv-to-json.indent')" label-placement="left" label-width="110" :show-feedback="false">
          <n-input-number v-model:value="indent" :min="0" :max="8" w-full />
        </n-form-item>
      </div>

      <n-space mt-4>
        <n-checkbox v-model:checked="hasHeader" :label="t('tools.csv-to-json.hasHeader')" />
        <n-checkbox v-model:checked="inferTypes" :label="t('tools.csv-to-json.inferTypes')" />
        <n-checkbox v-model:checked="trimValues" :label="t('tools.csv-to-json.trimValues')" />
      </n-space>
    </c-card>

    <n-alert v-if="result.error" type="error" mt-5>
      {{ result.error }}
    </n-alert>

    <c-card v-if="previewRows.length > 0" :title="t('tools.csv-to-json.preview')" mt-5>
      <n-scrollbar x-scrollable>
        <n-table :bordered="false" size="small" data-test-id="csv-to-json-preview">
          <thead>
            <tr>
              <th v-for="(header, index) in previewHeaders" :key="index">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
              <td v-for="(_, cellIndex) in previewHeaders" :key="cellIndex" style="white-space: pre-wrap">
                {{ row[cellIndex] ?? '' }}
              </td>
            </tr>
          </tbody>
        </n-table>
      </n-scrollbar>

      <div v-if="result.rows.length > previewRows.length" mt-2 text-xs op-60>
        {{ t('tools.csv-to-json.previewTruncated', { shown: previewRows.length, total: result.rows.length }) }}
      </div>
    </c-card>

    <c-card v-if="output" :title="t('tools.csv-to-json.output')" mt-5>
      <TextareaCopyable :value="output" language="json" />
    </c-card>
  </div>
</template>
