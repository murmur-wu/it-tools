import { expect, test } from '@playwright/test';

test.describe('Privacy policy page', () => {
  test('contains the disclosures AdSense requires', async ({ page }) => {
    await page.goto('/privacy');

    const policy = page.getByTestId('privacy-policy');
    await expect(policy.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
    await expect(page).toHaveTitle('Privacy policy - IT Tools');

    await expect(policy).toContainText('Third party vendors, including Google, use cookies to serve ads');
    await expect(policy.locator('a[href="https://adssettings.google.com/"]')).toHaveCount(1);
    await expect(policy.locator('a[href="https://www.aboutads.info/choices/"]')).toHaveCount(1);
  });

  test('is linked from the sidebar and from the about page', async ({ page }) => {
    await page.goto('/token-generator');
    await page.getByTestId('privacy-link').click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.goto('/about');
    const aboutLink = page.locator('a[href="/privacy"]').last();
    await expect(aboutLink).not.toHaveAttribute('target', '_blank');
    await aboutLink.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByTestId('privacy-policy')).toBeVisible();
  });
});
