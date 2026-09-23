import { expect, test } from '@playwright/test';

test.describe('AdSense', () => {
  test('keeps the ownership meta tag but does not load the ad script outside the production host', async ({ page }) => {
    await page.goto('/token-generator');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Token generator');

    await expect(page.locator('meta[name="google-adsense-account"]')).toHaveAttribute('content', 'ca-pub-6608473900936395');
    await expect(page.locator('script[src*="adsbygoogle.js"]')).toHaveCount(0);
  });
});
