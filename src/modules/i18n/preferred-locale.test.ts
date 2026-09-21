import { describe, expect, it } from 'vitest';
import { getPreferredLocale } from './preferred-locale';

const availableLocales = ['en', 'de', 'es', 'fr', 'no', 'pt', 'uk', 'vi', 'zh', 'zh-TW'];

describe('getPreferredLocale', () => {
  it('matches an exact locale, ignoring case', () => {
    expect(getPreferredLocale({ requestedLocales: ['zh-TW'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['zh-tw'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['fr'], availableLocales })).toBe('fr');
  });

  it('maps Traditional Chinese variants to zh-TW and other Chinese to zh', () => {
    expect(getPreferredLocale({ requestedLocales: ['zh-Hant'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['zh-Hant-TW'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['zh-HK'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['zh-CN'], availableLocales })).toBe('zh');
    expect(getPreferredLocale({ requestedLocales: ['zh-Hans'], availableLocales })).toBe('zh');
    expect(getPreferredLocale({ requestedLocales: ['zh'], availableLocales })).toBe('zh');
  });

  it('falls back to the language part of a regional tag', () => {
    expect(getPreferredLocale({ requestedLocales: ['en-US'], availableLocales })).toBe('en');
    expect(getPreferredLocale({ requestedLocales: ['pt-BR'], availableLocales })).toBe('pt');
    expect(getPreferredLocale({ requestedLocales: ['nb-NO'], availableLocales })).toBe('en');
  });

  it('walks the list in order and falls back to english', () => {
    expect(getPreferredLocale({ requestedLocales: ['ja', 'ko', 'zh-TW', 'en'], availableLocales })).toBe('zh-TW');
    expect(getPreferredLocale({ requestedLocales: ['ja', 'ko'], availableLocales })).toBe('en');
    expect(getPreferredLocale({ requestedLocales: [], availableLocales })).toBe('en');
    expect(getPreferredLocale({ requestedLocales: [''], availableLocales, fallback: 'de' })).toBe('de');
  });
});
