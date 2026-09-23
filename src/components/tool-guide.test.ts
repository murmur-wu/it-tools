import { readFileSync } from 'node:fs';
import { createI18n } from 'vue-i18n';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';

const locales = ['en', 'zh-TW', 'zh'] as const;

interface GuideSection { intro: string; useCases?: string[]; steps?: string[]; notes?: string[]; faq?: { q: string; a: string }[] }
interface LocaleMessages { tools: Record<string, { guide?: GuideSection }> }

const messages = Object.fromEntries(
  locales.map(locale => [locale, yaml.parse(readFileSync(`locales/${locale}.yml`, 'utf8'))]),
) as Record<string, LocaleMessages>;

// vue-i18n infers a message schema from the object it is given; the real locale files are deep
// enough to blow the instantiation limit, so the instance is built from a widened view of them.
function createTestI18n(locale: string) {
  return createI18n({ legacy: false, locale, messages: messages as unknown as Record<string, Record<string, string>> });
}

const guidedTools = Object.entries(messages.en.tools)
  .filter(([, tool]) => tool && typeof tool === 'object' && 'guide' in tool)
  .map(([key]) => key);

describe('tool guides', () => {
  it('has at least one tool with a guide', () => {
    expect(guidedTools.length).toBeGreaterThan(0);
  });

  it.each(locales)('exposes the same guide sections in %s as in en', (locale) => {
    for (const tool of guidedTools) {
      const guide = messages[locale].tools[tool]?.guide;

      expect(guide, `${tool} has no guide in ${locale}`).toBeDefined();
      expect(Object.keys(guide!).sort()).toEqual(Object.keys(messages.en.tools[tool].guide!).sort());
    }
  });

  it.each(locales)('keeps list sections the same length in %s as in en', (locale) => {
    for (const tool of guidedTools) {
      const guide = messages[locale].tools[tool].guide!;
      const reference = messages.en.tools[tool].guide!;

      for (const section of ['useCases', 'steps', 'notes', 'faq'] as const) {
        if (reference[section] === undefined) {
          continue;
        }

        expect(guide[section]?.length, `${tool}.${section} in ${locale}`).toBe(reference[section]!.length);
      }
    }
  });

  // `te()` reports false for array keys, so the component reads lists through `tm()`.
  // These assertions pin that behaviour down, since a regression renders empty sections.
  it.each(locales)('resolves every guide section through vue-i18n in %s', (locale) => {
    const { te, tm, rt } = createTestI18n(locale).global;

    for (const tool of guidedTools) {
      const base = `tools.${tool}.guide`;

      expect(te(`${base}.intro`), `${base}.intro`).toBe(true);

      for (const section of ['useCases', 'steps', 'notes'] as const) {
        const list = tm(`${base}.${section}`) as unknown[];
        expect(Array.isArray(list), `${base}.${section}`).toBe(true);
        expect(list.length).toBeGreaterThan(0);
        list.forEach(item => expect(rt(item as never).length).toBeGreaterThan(0));
      }

      const faq = tm(`${base}.faq`) as { q: unknown; a: unknown }[];
      expect(Array.isArray(faq), `${base}.faq`).toBe(true);
      faq.forEach((entry) => {
        expect(rt(entry.q as never).length).toBeGreaterThan(0);
        expect(rt(entry.a as never).length).toBeGreaterThan(0);
      });
    }
  });

  it('renders a literal at sign where a message escapes one', () => {
    const { tm, rt } = createTestI18n('en').global;
    const notes = tm('tools.crontab-generator.guide.notes') as unknown[];
    const rendered = notes.map(note => rt(note as never));

    expect(rendered.some(note => note.startsWith('@reboot'))).toBe(true);
  });
});
