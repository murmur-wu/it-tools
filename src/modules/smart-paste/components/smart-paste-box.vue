<script setup lang="ts">
import { IconClipboardText } from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import { detectContent } from '../smart-paste.detect';
import { useSmartPasteStore } from '../smart-paste.store';
import { useToolStore } from '@/tools/tools.store';

const router = useRouter();
const toolStore = useToolStore();
const smartPasteStore = useSmartPasteStore();

const content = ref('');

const suggestions = computed(() => detectContent(content.value)
  .map(({ kind, toolPath }) => ({ kind, toolPath, tool: toolStore.tools.find(tool => tool.path === toolPath) }))
  .filter(({ tool }) => tool !== undefined));

function openTool(toolPath: string) {
  smartPasteStore.stash({ toolPath, content: content.value.trim() });
  router.push(toolPath);
}

// Pasting jumps straight to the best matching tool; typing only shows the suggestions
function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text') ?? '';
  const best = detectContent(pasted).find(({ toolPath }) => toolStore.tools.some(tool => tool.path === toolPath));
  if (!best) {
    return;
  }
  event.preventDefault();
  content.value = pasted;
  openTool(best.toolPath);
}
</script>

<template>
  <c-card>
    <div mb-2 flex items-center gap-2 font-500>
      <n-icon :component="IconClipboardText" size="20" />
      {{ $t('smartPaste.title') }}
    </div>
    <n-input
      v-model:value="content"
      type="textarea"
      :placeholder="$t('smartPaste.placeholder')"
      :autosize="{ minRows: 2, maxRows: 6 }"
      data-test-id="smart-paste-input"
      @paste="onPaste"
    />
    <div v-if="suggestions.length > 0" mt-3 flex flex-wrap items-center gap-2>
      <span text-sm op-70>{{ $t('smartPaste.detected') }}</span>
      <c-button
        v-for="(suggestion, index) in suggestions"
        :key="suggestion.toolPath"
        size="small"
        :type="index === 0 ? 'primary' : 'default'"
        @click="openTool(suggestion.toolPath)"
      >
        {{ $t(`smartPaste.kinds.${suggestion.kind}`) }} · {{ suggestion.tool?.name }}
      </c-button>
    </div>
    <div v-else mt-2 text-xs op-60>
      {{ $t('smartPaste.hint') }}
    </div>
  </c-card>
</template>
