<script setup lang="ts">
import { marked } from 'marked';
import DomPurify from 'dompurify';

const props = withDefaults(defineProps<{ markdown?: string }>(), { markdown: '' });
const { markdown } = toRefs(props);

marked.use({
  renderer: {
    link(href, title, text) {
      // Pages of this site (e.g. /privacy) open in the same tab, external links in a new one
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const target = isInternal ? '' : ' target="_blank" rel="noopener"';
      return `<a class="text-primary transition decoration-none hover:underline" href="${href}"${target}>${text}</a>`;
    },
  },
});

const html = computed(() => DomPurify.sanitize(marked(markdown.value), { ADD_ATTR: ['target'] }));
</script>

<template>
  <div v-html="html" />
</template>
