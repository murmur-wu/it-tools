import { expect, test } from '@playwright/test';

test.describe('Tool - AES advanced encryption', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/aes-advanced-encryption');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('AES advanced encrypt / decrypt - IT Tools');
  });

  test('Encrypts with an explicit key and IV and decrypts back', async ({ page }) => {
    await page.getByTestId('aes-key').fill('2b7e151628aed2a6abf7158809cf4f3c');
    await page.getByTestId('aes-iv').fill('000102030405060708090a0b0c0d0e0f');
    await page.getByTestId('aes-plaintext').fill('hello world');

    const ciphertext = await page.getByTestId('aes-ciphertext').innerText();
    expect(ciphertext.trim().length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Use as decrypt input' }).click();
    await expect(page.getByTestId('aes-decrypted')).toHaveText('hello world');
  });
});
