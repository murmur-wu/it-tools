import type { Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSmartPasteStore } from '@/modules/smart-paste/smart-paste.store';

/**
 * Picks up content handed over by the home page "smart paste" box for the current tool.
 * Call it once in a tool's setup; when a target ref is given it is filled with the pasted content.
 */
export function useSmartPasteInput(target?: Ref<string>): string | undefined {
  const route = useRoute();
  const pasted = useSmartPasteStore().consume({ toolPath: route.path });

  if (pasted !== undefined && target) {
    target.value = pasted;
  }

  return pasted;
}
