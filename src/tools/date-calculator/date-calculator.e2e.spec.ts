import { type Page, expect, test } from '@playwright/test';

async function pickDate(page: Page, testId: string, isoDate: string) {
  const input = page.locator(`[data-test-id="${testId}"] input`);
  await input.click();
  await input.fill(isoDate);
  await input.press('Enter');
  await page.keyboard.press('Escape');
}

test.describe('Tool - Date calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/date-calculator');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Date calculator - IT Tools');
  });

  test('counts the days between two dates, with or without the end date', async ({ page }) => {
    await pickDate(page, 'date-calculator-start', '2026-01-01');
    await pickDate(page, 'date-calculator-end', '2026-01-31');
    await page.getByTestId('date-calculator-calculate').click();

    await expect(page.getByTestId('date-calculator-days')).toHaveText('30 days');
    await expect(page.getByTestId('date-calculator-result')).toContainText('The dates are 30 days apart');

    // Results follow later changes without pressing the button again
    await page.getByTestId('date-calculator-include-end').click();
    await expect(page.getByTestId('date-calculator-days')).toHaveText('31 days');
  });

  test('counts working days across the Lunar New Year holidays', async ({ page }) => {
    await pickDate(page, 'date-calculator-start', '2026-02-09');
    await pickDate(page, 'date-calculator-end', '2026-02-27');
    await page.getByTestId('date-calculator-include-end').click();
    await page.getByTestId('date-calculator-workdays').click();
    await page.getByTestId('date-calculator-calculate').click();

    await expect(page.getByTestId('date-calculator-days')).toHaveText('9 days');
    await expect(page.getByTestId('date-calculator-holidays-list')).toContainText('春節');
  });

  test('adds and subtracts working days', async ({ page }) => {
    await page.locator('.n-tabs-tab', { hasText: 'Add days' }).click();
    await pickDate(page, 'date-calculator-start', '2026-02-13');
    await page.locator('[data-test-id="date-calculator-amount"] input').fill('5');
    await page.getByTestId('date-calculator-workdays').click();
    await page.getByTestId('date-calculator-calculate').click();
    await expect(page.getByTestId('date-calculator-result')).toContainText('2026-03-02');

    await page.locator('.n-tabs-tab', { hasText: 'Subtract days' }).click();
    await pickDate(page, 'date-calculator-start', '2026-02-24');
    await page.locator('[data-test-id="date-calculator-amount"] input').fill('5');
    await page.getByTestId('date-calculator-calculate').click();
    await expect(page.getByTestId('date-calculator-result')).toContainText('2026-02-10');
  });

  test('asks for the missing dates instead of showing a result', async ({ page }) => {
    await page.getByTestId('date-calculator-calculate').click();

    await expect(page.getByTestId('date-calculator-error')).toHaveText('Pick a start date.');
    await expect(page.getByTestId('date-calculator-result')).toHaveCount(0);
  });
});
