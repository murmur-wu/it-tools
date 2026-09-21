import { useSessionStorage } from '@vueuse/core';
import { defineStore } from 'pinia';

interface PendingPaste {
  toolPath: string
  content: string
}

export const useSmartPasteStore = defineStore('smart-paste', () => {
  // Kept in sessionStorage so the value survives the navigation to the tool but not a new tab
  const pending = useSessionStorage<string>('smart-paste:pending', '');

  function readPending(): PendingPaste | undefined {
    if (!pending.value) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(pending.value) as Partial<PendingPaste>;
      return typeof parsed.toolPath === 'string' && typeof parsed.content === 'string' ? { toolPath: parsed.toolPath, content: parsed.content } : undefined;
    }
    catch {
      return undefined;
    }
  }

  return {
    stash({ toolPath, content }: PendingPaste) {
      pending.value = JSON.stringify({ toolPath, content });
    },

    // Returns the pasted content for this tool (once) and clears it
    consume({ toolPath }: { toolPath: string }): string | undefined {
      const current = readPending();
      if (!current || current.toolPath !== toolPath) {
        return undefined;
      }
      pending.value = '';
      return current.content;
    },
  };
});
