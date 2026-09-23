import type { App } from 'vue';
import { config } from '@/config';
import { isSiteHost } from '@/utils/siteHost';

export function shouldLoadAdsense({ clientId, siteUrl, currentHost }: { clientId: string; siteUrl: string; currentHost: string }): boolean {
  return Boolean(clientId) && isSiteHost({ siteUrl, currentHost });
}

export function buildAdsenseScriptUrl({ clientId }: { clientId: string }): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}

export const adsense = {
  install(_app: App) {
    const clientId = config.adsense.clientId;

    // Only load the ad script on the real site, never on localhost or preview deployments,
    // so previews do not request ads or count as unverified sites in AdSense
    if (!shouldLoadAdsense({ clientId, siteUrl: config.app.siteUrl, currentHost: window.location.host })) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = buildAdsenseScriptUrl({ clientId });
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  },
};
