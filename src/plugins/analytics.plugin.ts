import type { App } from 'vue';
import { nextTick } from 'vue';
import type { Router } from 'vue-router';
import { config } from '@/config';
import { isSiteHost } from '@/utils/siteHost';

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function shouldEnableAnalytics({ measurementId, siteUrl, currentHost }: { measurementId: string; siteUrl: string; currentHost: string }): boolean {
  return Boolean(measurementId) && isSiteHost({ siteUrl, currentHost });
}

export function createAnalytics({ router }: { router: Router }) {
  return {
    install(_app: App) {
      const measurementId = config.analytics.gaMeasurementId;

      // Only load Google Analytics on the real site, never on localhost or preview deployments
      if (!shouldEnableAnalytics({ measurementId, siteUrl: config.app.siteUrl, currentHost: window.location.host })) {
        return;
      }

      window.dataLayer = window.dataLayer ?? [];
      window.gtag = function gtag() {
        // gtag.js expects the raw `arguments` object on the data layer, not an array
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      // Page views are sent manually on route change so SPA navigation is counted
      window.gtag('config', measurementId, { send_page_view: false });

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);

      router.afterEach((to) => {
        // Wait a tick so the page title set by useHead is already applied
        nextTick(() => {
          window.gtag('event', 'page_view', {
            page_path: to.fullPath,
            page_location: window.location.href,
            page_title: document.title,
          });
        });
      });
    },
  };
}
