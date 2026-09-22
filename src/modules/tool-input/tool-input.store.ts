import { defineStore } from 'pinia';
import { type Ref, shallowReactive } from 'vue';

export interface ToolRegistration {
  input?: Ref<string>
  example?: string
  output?: Ref<string>
  run?: () => void
}

// Tools register their main input/output/run action here so the tool layout can offer
// "load example", "share link", and the keyboard shortcuts without knowing each tool.
export const useToolInputStore = defineStore('tool-input', () => {
  const registrations = shallowReactive(new Map<string, ToolRegistration>());

  function register(path: string, registration: ToolRegistration) {
    registrations.set(path, { ...registrations.get(path), ...registration });
  }

  function unregister(path: string, keys: (keyof ToolRegistration)[]) {
    const current = registrations.get(path);
    if (!current) {
      return;
    }
    const next: ToolRegistration = { ...current };
    for (const key of keys) {
      delete next[key];
    }
    if (Object.keys(next).length === 0) {
      registrations.delete(path);
    }
    else {
      registrations.set(path, next);
    }
  }

  function get(path: string): ToolRegistration | undefined {
    return registrations.get(path);
  }

  return { register, unregister, get };
});
