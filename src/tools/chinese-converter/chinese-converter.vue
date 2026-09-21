<script setup lang="ts">
import { type ChineseVariant, convertChinese, countChineseCharacters, sourceVariants, targetVariants } from './chinese-converter.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useSmartPasteInput } from '@/composable/smartPasteInput';

const input = ref('');
useSmartPasteInput(input);

const from = useStorage<ChineseVariant>('chinese-converter:from', 'cn');
const to = useStorage<ChineseVariant>('chinese-converter:to', 'twp');

const sourceOptions = sourceVariants.map(({ value, label }) => ({ value, label }));
const targetOptions = targetVariants.map(({ value, label }) => ({ value, label }));

const output = computed(() => {
  try {
    return { text: convertChinese({ text: input.value, from: from.value, to: to.value }), error: undefined };
  }
  catch (error) {
    return { text: '', error: error instanceof Error ? error.message : String(error) };
  }
});

const stats = computed(() => ({
  characters: input.value.length,
  chinese: countChineseCharacters(input.value),
  changed: [...input.value].filter((char, index) => output.value.text[index] !== char).length,
}));

function swapDirection() {
  const previousTo = to.value;
  const previousFrom = from.value;
  // "twp" only exists as a target; going back from Taiwanese phrases means converting from Taiwan traditional
  from.value = previousTo === 'twp' ? 'tw' : previousTo;
  to.value = previousFrom === 'cn' ? 'cn' : previousFrom;
  if (output.value.text) {
    input.value = output.value.text;
  }
}

function loadExample() {
  from.value = 'cn';
  to.value = 'twp';
  input.value = '我们的软件在服务器上运行，通过网络接口读取数据库，并把结果打印出来。';
}
</script>

<template>
  <div flex flex-col gap-4>
    <c-card>
      <div flex flex-wrap items-end gap-2>
        <c-select v-model:value="from" label="From:" :options="sourceOptions" flex-1 />
        <c-button circle variant="text" aria-label="Swap direction" mb-1 @click="swapDirection()">
          <icon-mdi-swap-horizontal />
        </c-button>
        <c-select v-model:value="to" label="To:" :options="targetOptions" flex-1 />
      </div>
      <div mt-1 text-xs op-70>
        {{ targetVariants.find(v => v.value === to)?.description }}
      </div>

      <c-input-text
        v-model:value="input"
        label="Text:"
        placeholder="貼上要轉換的中文……"
        rows="6"
        multiline raw-text autosize autofocus mt-4
        test-id="chinese-input"
      />
      <div mt-2 flex flex-wrap items-center gap-3 text-xs op-70>
        <span>{{ stats.characters }} characters, {{ stats.chinese }} Chinese, {{ stats.changed }} changed</span>
        <span flex-1 />
        <c-button size="small" @click="loadExample()">
          Load example
        </c-button>
      </div>
    </c-card>

    <c-card>
      <c-alert v-if="output.error" type="error" title="Unable to convert">
        {{ output.error }}
      </c-alert>
      <template v-else>
        <div mb-1>
          Converted text:
        </div>
        <TextareaCopyable :value="output.text" data-test-id="chinese-output" />
      </template>
      <div mt-3 text-xs op-60>
        Conversion tables from <a href="https://github.com/BYVoid/OpenCC" target="_blank" rel="noopener">OpenCC</a>, running entirely in your browser.
      </div>
    </c-card>
  </div>
</template>
