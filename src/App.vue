<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import { useHead } from '@vueuse/head';
import { NGlobalStyle, NMessageProvider, NNotificationProvider, darkTheme } from 'naive-ui';
import { darkThemeOverrides, lightThemeOverrides } from './themes';
import { layouts } from './layouts';
import { useStyleStore } from './stores/style.store';
import { getPreferredLocale } from './modules/i18n/preferred-locale';

const route = useRoute();
const layout = computed(() => route?.meta?.layout ?? layouts.base);
const styleStore = useStyleStore();

const theme = computed(() => (styleStore.isDarkTheme ? darkTheme : null));
const themeOverrides = computed(() => (styleStore.isDarkTheme ? darkThemeOverrides : lightThemeOverrides));

const { locale, availableLocales } = useI18n();

// First visit: pick the language from the browser; afterwards the user's choice is remembered
const storedLocale = useStorage<string>('locale', '', undefined, { writeDefaults: false });
if (!availableLocales.includes(storedLocale.value)) {
  storedLocale.value = getPreferredLocale({
    requestedLocales: navigator.languages ?? [navigator.language],
    availableLocales,
  });
}
locale.value = storedLocale.value;
watch(locale, value => storedLocale.value = value);

// Keep <html lang> in sync with the current language
useHead(computed(() => ({ htmlAttrs: { lang: locale.value } })));
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NMessageProvider placement="bottom">
      <NNotificationProvider placement="bottom-right">
        <component :is="layout">
          <RouterView />
        </component>
      </NNotificationProvider>
    </NMessageProvider>
  </n-config-provider>
</template>

<style>
body {
  min-height: 100%;
  margin: 0;
  padding: 0;
}

html {
  height: 100%;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
</style>
