import { type Ref, computed, onScopeDispose } from 'vue';
import { useRoute } from 'vue-router';
import { useSmartPasteStore } from '@/modules/smart-paste/smart-paste.store';
import { useToolInputStore } from '@/modules/tool-input/tool-input.store';

export const shareQueryParam = 'input';

export function buildShareUrl({ origin, path, input }: { origin: string; path: string; input: string }): string {
  const url = new URL(path, origin);
  url.searchParams.set(shareQueryParam, input);
  return url.toString();
}

/**
 * Declares the main text input of a tool. Call it once in the tool's setup.
 * - fills it with content handed over by the home page "smart paste" box
 * - fills it from the `?input=` query parameter (share links)
 * - lets the tool layout offer "load example" and "share link"
 * Returns the value that was injected, if any.
 */
export function useToolInput(target: Ref<string>, { example }: { example?: string } = {}): string | undefined {
  const route = useRoute();
  const path = route.path;
  let injected: string | undefined;

  const pasted = useSmartPasteStore().consume({ toolPath: path });
  if (pasted !== undefined) {
    injected = pasted;
  }

  const fromQuery = route.query[shareQueryParam];
  if (typeof fromQuery === 'string') {
    injected = fromQuery;
  }

  if (injected !== undefined) {
    target.value = injected;
  }

  const store = useToolInputStore();
  store.register(path, { input: target, example });
  onScopeDispose(() => store.unregister(path, ['input', 'example']));

  return injected;
}

/** Declares the main result of a tool so Ctrl+Shift+C copies it. */
export function useToolOutput(source: Ref<string> | (() => string)): void {
  const route = useRoute();
  const path = route.path;
  const store = useToolInputStore();
  store.register(path, { output: typeof source === 'function' ? computed(source) : source });
  onScopeDispose(() => store.unregister(path, ['output']));
}

/** Declares the tool's "run again" action (regenerate, refresh) so Ctrl+Enter triggers it. */
export function useToolRun(run: () => void): void {
  const route = useRoute();
  const path = route.path;
  const store = useToolInputStore();
  store.register(path, { run });
  onScopeDispose(() => store.unregister(path, ['run']));
}
