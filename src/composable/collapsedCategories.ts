import { useStorage } from '@vueuse/core';

export interface CollapsedCategories {
  isCollapsed: (options: { key: string; legacyKey?: string }) => boolean
  toggle: (options: { key: string; legacyKey?: string }) => void
}

export function useCollapsedCategories(storageKey: string): CollapsedCategories {
  const collapsedCategories = useStorage<Record<string, boolean>>(
    storageKey,
    {},
    undefined,
    {
      deep: true,
      serializer: {
        read: v => (v ? JSON.parse(v) : {}),
        write: v => JSON.stringify(v),
      },
    },
  );

  // Collapse state used to be stored under the translated category label, which was lost
  // whenever the interface language changed. Legacy entries are still honoured, and are
  // rewritten to the stable key the first time a category is toggled.
  function isCollapsed({ key, legacyKey }: { key: string; legacyKey?: string }) {
    const state = collapsedCategories.value ?? {};

    return state[key] ?? (legacyKey ? state[legacyKey] : undefined) ?? false;
  }

  function toggle({ key, legacyKey }: { key: string; legacyKey?: string }) {
    const collapsed = !isCollapsed({ key, legacyKey });

    if (legacyKey && legacyKey !== key && collapsedCategories.value?.[legacyKey] !== undefined) {
      delete collapsedCategories.value[legacyKey];
    }

    collapsedCategories.value = { ...collapsedCategories.value, [key]: collapsed };
  }

  return { isCollapsed, toggle };
}
