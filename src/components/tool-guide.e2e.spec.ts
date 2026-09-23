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
});
