import { describe, expect, it } from 'vitest';
import { buildAdsenseScriptUrl, shouldLoadAdsense } from './adsense.plugin';

describe('adsense plugin', () => {
  describe('shouldLoadAdsense', () => {
    it('is enabled only on the configured site host', () => {
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'https://ittools.heitang.info', currentHost: 'ittools.heitang.info' })).toBe(true);
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'https://ittools.heitang.info/', currentHost: 'ittools.heitang.info' })).toBe(true);
    });

    it('is disabled on localhost and preview hosts', () => {
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'https://ittools.heitang.info', currentHost: 'localhost:5173' })).toBe(false);
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'https://ittools.heitang.info', currentHost: 'claude-repo-dev-workflow-ws6yjn-it-tools.z-file.workers.dev' })).toBe(false);
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'https://ittools.heitang.info', currentHost: 'it-tools.z-file.workers.dev' })).toBe(false);
    });

    it('is disabled without a publisher id or a valid site url', () => {
      expect(shouldLoadAdsense({ clientId: '', siteUrl: 'https://ittools.heitang.info', currentHost: 'ittools.heitang.info' })).toBe(false);
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: '', currentHost: 'ittools.heitang.info' })).toBe(false);
      expect(shouldLoadAdsense({ clientId: 'ca-pub-1', siteUrl: 'not a url', currentHost: 'ittools.heitang.info' })).toBe(false);
    });
  });

  describe('buildAdsenseScriptUrl', () => {
    it('points to the AdSense loader with the publisher id', () => {
      expect(buildAdsenseScriptUrl({ clientId: 'ca-pub-6608473900936395' }))
        .toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6608473900936395');
    });
  });
});
