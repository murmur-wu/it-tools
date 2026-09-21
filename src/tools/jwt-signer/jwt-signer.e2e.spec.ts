import { expect, test } from '@playwright/test';

test.describe('Tool - JWT signer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jwt-signer');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('JWT sign and verify - IT Tools');
  });

  test('Signs with HS256 and verifies the result', async ({ page }) => {
    await page.getByTestId('jwt-payload').fill('{"sub":"1234567890","name":"John Doe","iat":1516239022}');
    await page.getByTestId('jwt-secret').fill('your-256-bit-secret');
    await expect(page.getByTestId('jwt-token')).toHaveValue(/^eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9\./);

    await page.getByRole('button', { name: 'Use in verify' }).click();
    await expect(page.getByTestId('jwt-verify-status')).toContainText('Signature valid (HS256)');

    await page.getByTestId('jwt-verify-secret').fill('wrong');
    await expect(page.getByTestId('jwt-verify-status')).toContainText('Signature invalid');
  });
});
