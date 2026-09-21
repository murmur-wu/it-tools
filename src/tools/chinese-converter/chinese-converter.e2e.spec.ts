import { expect, test } from '@playwright/test';

test.describe('Tool - Chinese converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chinese-converter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Traditional / Simplified Chinese converter - IT Tools');
  });

  test('Converts simplified Chinese to Taiwanese traditional with phrases', async ({ page }) => {
    await page.getByRole('button', { name: 'Load example' }).click();
    await expect(page.getByTestId('chinese-output')).toContainText('軟體');
    await expect(page.getByTestId('chinese-output')).toContainText('伺服器');
  });
});
