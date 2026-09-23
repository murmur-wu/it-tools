<script setup lang="ts">
/**
 * Renders the long-form guide of a tool, entirely driven by i18n.
 *
 * A tool gets a guide as soon as `tools.<tool-key>.guide.intro` exists in a locale file;
 * tools without one render nothing. See CLAUDE.md for the expected shape.
 */
const props = defineProps<{ toolKey: string }>();
const { toolKey } = toRefs(props);

const { t, tm, rt, te } = useI18n();

const guideKey = computed(() => `tools.${toolKey.value}.guide`);

function hasKey(key: string) {
  return te(key) || te(key, 'en');
}

// `te` only recognises leaf string messages, so list sections are read with `tm`,
// which returns the array when it exists and an empty object when it does not.
function listOf(section: string): string[] {
  const messages: unknown = tm(`${guideKey.value}.${section}`);

  if (!Array.isArray(messages)) {
    return [];
  }

  return (messages as never[]).map(message => rt(message));
}

function faqOf(): { question: string; answer: string }[] {
  const messages: unknown = tm(`${guideKey.value}.faq`);

  if (!Array.isArray(messages)) {
    return [];
  }

  return (messages as Record<string, never>[]).map(message => ({
    question: rt(message.q),
    answer: rt(message.a),
  }));
}

const hasGuide = computed(() => hasKey(`${guideKey.value}.intro`));
const intro = computed(() => t(`${guideKey.value}.intro`));
const useCases = computed(() => listOf('useCases'));
const steps = computed(() => listOf('steps'));
const notes = computed(() => listOf('notes'));
const faq = computed(() => faqOf());
</script>

<template>
  <div v-if="hasGuide" class="tool-guide" data-test-id="tool-guide">
    <n-divider />

    <h2 class="guide-title">
      {{ t('toolGuide.title', { tool: t(`tools.${toolKey}.title`) }) }}
    </h2>

    <p class="guide-intro">
      {{ intro }}
    </p>

    <template v-if="useCases.length > 0">
      <h3>{{ t('toolGuide.useCases') }}</h3>
      <ul>
        <li v-for="(useCase, index) in useCases" :key="index">
          {{ useCase }}
        </li>
      </ul>
    </template>

    <template v-if="steps.length > 0">
      <h3>{{ t('toolGuide.steps') }}</h3>
      <ol>
        <li v-for="(step, index) in steps" :key="index">
          {{ step }}
        </li>
      </ol>
    </template>

    <template v-if="notes.length > 0">
      <h3>{{ t('toolGuide.notes') }}</h3>
      <ul>
        <li v-for="(note, index) in notes" :key="index">
          {{ note }}
        </li>
      </ul>
    </template>

    <template v-if="faq.length > 0">
      <h3>{{ t('toolGuide.faq') }}</h3>
      <div v-for="(entry, index) in faq" :key="index" class="faq-entry">
        <div class="faq-question">
          {{ entry.question }}
        </div>
        <div class="faq-answer">
          {{ entry.answer }}
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="less" scoped>
.tool-guide {
  max-width: 600px;
  margin: 40px auto 0;
  box-sizing: border-box;
  line-height: 1.7;

  .guide-title {
    font-size: 22px;
    font-weight: 500;
    opacity: 0.9;
    margin: 0 0 12px;
  }

  .guide-intro {
    margin: 0;
    opacity: 0.8;
  }

  h3 {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.9;
    margin: 24px 0 8px;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 22px;
    opacity: 0.8;

    li {
      margin-bottom: 6px;
    }
  }

  .faq-entry {
    margin-bottom: 14px;

    .faq-question {
      font-weight: 500;
      opacity: 0.9;
    }

    .faq-answer {
      opacity: 0.8;
    }
  }
}
</style>
