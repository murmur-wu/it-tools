/**
 * Whether the page is served from the configured public site, as opposed to localhost
 * or a preview deployment. Third-party scripts (analytics, ads) are only loaded there.
 */
export function isSiteHost({ siteUrl, currentHost }: { siteUrl: string; currentHost: string }): boolean {
  if (!siteUrl) {
    return false;
  }

  try {
    return new URL(siteUrl).host === currentHost;
  }
  catch {
    return false;
  }
}
