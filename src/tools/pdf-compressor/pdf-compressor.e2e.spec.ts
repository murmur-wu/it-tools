import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';

function fixture(name: string) {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

// Naive UI lays the radio input over its label, so the input is what receives the click
function choosePreset(page: Page, preset: 'screen' | 'ebook' | 'printer') {
  return page.locator(`[data-test-id="pdf-compressor-preset"] input[value="${preset}"]`).click();
}

test.describe('Tool - PDF compressor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf-compressor');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('PDF compressor - IT Tools');
  });

  test('compresses a scanned PDF in the browser and offers the smaller file', async ({ page }) => {
    await choosePreset(page, 'screen');
    await page.locator('[data-test-id="pdf-compressor-upload"] input[type="file"]').setInputFiles(fixture('scanned-page.pdf'));

    const row = page.locator('[data-test-id="compressed-pdf"]');
    await expect(row).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
    await expect(row).toContainText('scanned-page-compressed.pdf');
    await expect(row.locator('[data-test-id="pdf-compressor-ratio"]')).toHaveText(/^-[5-9]\d%$/);

    const downloadPromise = page.waitForEvent('download');
    await row.locator('[data-test-id="pdf-compressor-download"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('scanned-page-compressed.pdf');
  });

  test('keeps the original when the chosen level cannot make it smaller', async ({ page }) => {
    // "Balanced" (the default) does not shrink this 200 dpi scan any further
    await page.locator('[data-test-id="pdf-compressor-upload"] input[type="file"]').setInputFiles(fixture('scanned-page.pdf'));

    const row = page.locator('[data-test-id="compressed-pdf"]');
    await expect(row).toHaveAttribute('data-status', 'not-smaller', { timeout: 60_000 });
    await expect(row).toContainText('cannot make the file any smaller');
    await expect(row.locator('[data-test-id="pdf-compressor-download"]')).toHaveCount(0);

    // Switching level lets the user try again on the same file
    await choosePreset(page, 'screen');
    await row.locator('[data-test-id="pdf-compressor-recompress"]').click();
    await expect(row).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
  });

  test('explains that password-protected PDFs cannot be compressed', async ({ page }) => {
    await page.locator('[data-test-id="pdf-compressor-upload"] input[type="file"]').setInputFiles(fixture('password-protected.pdf'));

    const row = page.locator('[data-test-id="compressed-pdf"]');
    await expect(row).toHaveAttribute('data-status', 'error', { timeout: 60_000 });
    await expect(row).toContainText('password-protected');
  });

  test('rejects files that are not PDFs', async ({ page }) => {
    await page.locator('[data-test-id="pdf-compressor-upload"] input[type="file"]').setInputFiles({
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('just some text'),
    });

    const row = page.locator('[data-test-id="compressed-pdf"]');
    await expect(row).toHaveAttribute('data-status', 'error');
    await expect(row).toContainText('This is not a PDF file.');
  });
});
