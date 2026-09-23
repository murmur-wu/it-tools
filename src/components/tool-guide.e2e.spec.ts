import { expect, test } from '@playwright/test';

test.describe('Tool guide section', () => {
  test('is rendered for a tool that has guide content', async ({ page }) => {
    await page.goto('/crontab-generator');

    const guide = page.getByTestId('tool-guide');
    await expect(guide).toBeVisible();

    await expect(guide.getByRole('heading', { level: 3 })).toHaveCount(4);
    await expect(guide).toContainText('When you would use it');
    await expect(guide).toContainText('Frequently asked questions');
    await expect(guide).toContainText('*/15 * * * *');
  });

  test('is absent for a tool without guide content', async ({ page }) => {
    await page.goto('/token-generator');

    await expect(page.getByTestId('tool-guide')).toHaveCount(0);
  });

  test('follows the tool when navigating between tools without a page reload', async ({ page }) => {
    await page.goto('/password-generator');
    await expect(page.getByTestId('tool-guide')).toContainText('Password generator');

    // Client-side navigation keeps the layout mounted, so the guide must update in place
    await page.locator('a[href="/hash-text"]').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hash text');
    await expect(page.getByTestId('tool-guide')).toContainText('Hash text');
    await expect(page.getByTestId('tool-guide')).not.toContainText('Password generator');

    await page.locator('a[href="/token-generator"]').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Token generator');
    await expect(page.getByTestId('tool-guide')).toHaveCount(0);
  });
});
