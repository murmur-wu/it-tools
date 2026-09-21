import { expect, test } from '@playwright/test';
import { ecCertificatePem } from './certificate-parser.fixtures';

test.describe('Tool - Certificate parser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/certificate-parser');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('X.509 certificate parser - IT Tools');
  });

  test('Parses a pasted certificate', async ({ page }) => {
    await page.getByTestId('certificate-input').fill(ecCertificatePem);
    const card = page.getByTestId('certificate-0');
    await expect(card).toContainText('ec.example.com');
    await expect(card).toContainText('ECDSA with SHA-256');
    await expect(card).toContainText('DNS:ec.example.com');
  });
});
