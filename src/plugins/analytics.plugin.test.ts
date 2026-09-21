import { describe, expect, it } from 'vitest';
import { shouldEnableAnalytics } from './analytics.plugin';

describe('analytics plugin', () => {
  describe('shouldEnableAnalytics', () => {
    it('is enabled only on the configured site host', () => {
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: 'https://ittools.heitang.info', currentHost: 'ittools.heitang.info' })).toBe(true);
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: 'https://ittools.heitang.info/', currentHost: 'ittools.heitang.info' })).toBe(true);
    });

    it('is disabled on localhost and preview hosts', () => {
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: 'https://ittools.heitang.info', currentHost: 'localhost:5173' })).toBe(false);
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: 'https://ittools.heitang.info', currentHost: 'dev-it-tools.z-file.workers.dev' })).toBe(false);
    });

    it('is disabled without a measurement id or a valid site url', () => {
      expect(shouldEnableAnalytics({ measurementId: '', siteUrl: 'https://ittools.heitang.info', currentHost: 'ittools.heitang.info' })).toBe(false);
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: '', currentHost: 'ittools.heitang.info' })).toBe(false);
      expect(shouldEnableAnalytics({ measurementId: 'G-TEST', siteUrl: 'not a url', currentHost: 'ittools.heitang.info' })).toBe(false);
    });
  });
});
