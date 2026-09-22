<script setup lang="ts">
import markdownit from 'markdown-it';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useToolInput } from '@/composable/toolInput';

const inputMarkdown = ref('');
useToolInput(inputMarkdown, { example: '# IT Tools\n\nSome **bold** and _italic_ text.\n\n- item one\n- item two\n\n[link](https://ittools.heitang.info)' });
const outputHtml = computed(() => {
  const md = markdownit();
  return md.render(inputMarkdown.value);
});

function printHtml() {
  const w = window.open();
  if (w === null) {
    return;
  }
  w.document.body.innerHTML = outputHtml.value;
  w.print();
}
</script>

<template>
  <div>
    <c-input-text
      v-model:value="inputMarkdown"
      multiline raw-text
      placeholder="Your Markdown content..."
      rows="8"
      autofocus
      label="Your Markdown to convert:"
    />

    <n-divider />

    <n-form-item label="Output HTML:">
      <TextareaCopyable :value="outputHtml" :word-wrap="true" language="html" />
    </n-form-item>

    <div flex justify-center>
      <n-button @click="printHtml">
        Print as PDF
      </n-button>
    </div>
  </div>
</template>
