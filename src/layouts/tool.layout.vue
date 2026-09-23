<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@vueuse/head';
import type { HeadObject } from '@vueuse/head';

import BaseLayout from './base.layout.vue';
import FavoriteButton from '@/components/FavoriteButton.vue';
import ToolGuide from '@/components/ToolGuide.vue';
import type { Tool } from '@/tools/tools.types';
import { useToolStore } from '@/tools/tools.store';
import { useToolInputStore } from '@/modules/tool-input/tool-input.store';
import { buildShareUrl, shareQueryParam } from '@/composable/toolInput';
import { useCopy } from '@/composable/copy';
import { config } from '@/config';

const route = useRoute();
const { t } = useI18n();
const toolStore = useToolStore();

// Remember the tools the user opens so the home page can list them under "recent tools"
watch(() => route.path, path => toolStore.addToolToRecent({ path }), { immediate: true });

const i18nKey = computed<string>(() => route.path.trim().replace('/', ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
const toolDescription = computed<string>(() => t(`tools.${i18nKey.value}.description`, String(route.meta.description)));

const { locale } = useI18n();
const pageUrl = computed(() => (config.app.siteUrl ? `${config.app.siteUrl}${route.path}` : undefined));

// Title, description and JSON-LD follow the current language so search engines index localised pages
const head = computed<HeadObject>(() => ({
  title: `${toolTitle.value} - IT Tools`,
  meta: [
    { name: 'description', content: toolDescription.value },
    { name: 'keywords', content: ((route.meta.keywords ?? []) as string[]).join(',') },
    { property: 'og:title', content: `${toolTitle.value} - IT Tools` },
    { property: 'og:description', content: toolDescription.value },
    ...(pageUrl.value ? [{ property: 'og:url', content: pageUrl.value }] : []),
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': toolTitle.value,
        'description': toolDescription.value,
        ...(pageUrl.value ? { url: pageUrl.value } : {}),
        'applicationCategory': 'DeveloperApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires JavaScript',
        'inLanguage': locale.value,
        'isAccessibleForFree': true,
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        ...(config.app.siteUrl ? { isPartOf: { '@type': 'WebSite', 'name': 'IT Tools', 'url': config.app.siteUrl } } : {}),
      }),
    },
  ],
}));
useHead(head);

// Actions the tool registered through useToolInput / useToolOutput / useToolRun
const toolInputStore = useToolInputStore();
const registration = computed(() => toolInputStore.get(route.path));
const canLoadExample = computed(() => registration.value?.input !== undefined && registration.value?.example !== undefined);
const canShare = computed(() => registration.value?.input !== undefined);
const router = useRouter();
const { copy: copyRaw } = useCopy({ createToast: true });

function loadExample() {
  const current = registration.value;
  if (current?.input && current.example !== undefined) {
    current.input.value = current.example;
  }
}

async function shareLink() {
  const input = registration.value?.input?.value ?? '';
  const url = buildShareUrl({ origin: window.location.origin, path: route.path, input });
  await router.replace({ query: { ...route.query, [shareQueryParam]: input } });
  await copyRaw(url, { notificationMessage: t('toolLayout.linkCopied') });
}

async function copyOutput() {
  const output = registration.value?.output?.value;
  if (output) {
    await copyRaw(output, { notificationMessage: t('toolLayout.outputCopied') });
  }
}

// Ctrl/Cmd+Enter runs again (generators), Ctrl/Cmd+Shift+C copies the main result
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key === 'Enter' && registration.value?.run) {
    event.preventDefault();
    registration.value.run();
  }
  else if (mod && event.shiftKey && event.key.toLowerCase() === 'c' && registration.value?.output) {
    event.preventDefault();
    copyOutput();
  }
});
</script>

<template>
  <BaseLayout>
    <div class="tool-layout">
      <div class="tool-header">
        <div flex flex-nowrap items-center justify-between>
          <n-h1>
            {{ toolTitle }}
          </n-h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: route.path } as Tool" />
          </div>
        </div>

        <div class="separator" />

        <div class="description">
          {{ toolDescription }}
        </div>

        <div v-if="canLoadExample || canShare || registration?.run || registration?.output" class="actions" mt-3 flex flex-wrap items-center gap-2>
          <c-button v-if="canLoadExample" size="small" data-test-id="load-example" @click="loadExample()">
            {{ $t('toolLayout.loadExample') }}
          </c-button>
          <c-tooltip v-if="canShare" :tooltip="$t('toolLayout.shareLinkTooltip')" position="bottom">
            <c-button size="small" data-test-id="share-link" @click="shareLink()">
              {{ $t('toolLayout.shareLink') }}
            </c-button>
          </c-tooltip>
          <span v-if="registration?.run || registration?.output" text-xs op-60>
            <template v-if="registration?.run">Ctrl+Enter {{ $t('toolLayout.shortcutRun') }}</template>
            <template v-if="registration?.run && registration?.output"> · </template>
            <template v-if="registration?.output">Ctrl+Shift+C {{ $t('toolLayout.shortcutCopy') }}</template>
          </span>
        </div>
      </div>
    </div>

    <div class="tool-content">
      <slot />
    </div>

    <ToolGuide :tool-key="i18nKey" />
  </BaseLayout>
</template>

<style lang="less" scoped>
.tool-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;

  ::v-deep(& > *) {
    flex: 0 1 600px;
  }
}

.tool-layout {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;

  .tool-header {
    padding: 40px 0;
    width: 100%;

    .n-h1 {
      opacity: 0.9;
      font-size: 40px;
      font-weight: 400;
      margin: 0;
      line-height: 1;
    }

    .separator {
      width: 200px;
      height: 2px;
      background: rgb(161, 161, 161);
      opacity: 0.2;

      margin: 10px 0;
    }

    .description {
      margin: 0;

      opacity: 0.7;
    }
  }
}
</style>
