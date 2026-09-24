<script setup lang="ts">
import { useHead } from '@vueuse/head';

const { t } = useI18n();
useHead(computed(() => ({ title: `${t('privacy.title')} - IT Tools` })));
</script>

<template>
  <c-markdown :markdown="$t('privacy.content')" mx-auto mt-50px max-w-600px data-test-id="privacy-policy" />
</template>
