export function getPreferredLocale({
  requestedLocales,
  availableLocales,
  fallback = 'en',
}: {
  requestedLocales: readonly string[]
  availableLocales: readonly string[]
  fallback?: string
}): string {
  const findAvailable = (predicate: (locale: string) => boolean) => availableLocales.find(locale => predicate(locale.toLowerCase()));

  for (const requested of requestedLocales) {
    const tag = requested.trim().toLowerCase();
    if (!tag) {
      continue;
    }

    const exact = findAvailable(locale => locale === tag);
    if (exact) {
      return exact;
    }

    // Traditional Chinese regions and scripts map to zh-TW, everything else Chinese to zh
    if (/^zh(-hant|-tw|-hk|-mo)/.test(tag)) {
      const traditional = findAvailable(locale => locale === 'zh-tw');
      if (traditional) {
        return traditional;
      }
    }

    const base = tag.split('-')[0];
    const byBase = findAvailable(locale => locale === base);
    if (byBase) {
      return byBase;
    }
  }

  return fallback;
}
