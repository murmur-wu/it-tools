import { expect, test } from '@playwright/test';

test.describe('Tool - Video compressor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/video-compressor');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Video compressor - IT Tools');
  });

  test('Compresses a WebM clip and offers it for download', async ({ page }) => {
    // WebCodecs is not available in every browser Playwright drives (WebKit on Linux, older Firefox):
    // there the tool shows its warning instead, which is the behaviour to check
    const hasWebCodecs = await page.evaluate(() => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined');
    if (!hasWebCodecs) {
      await expect(page.getByTestId('video-compressor-unsupported')).toBeVisible();
      return;
    }

    await expect(page.getByTestId('video-compressor-unsupported')).toHaveCount(0);

    // Only WebM is chosen since H.264 encoders are not part of every Chromium build
    await page.getByTestId('video-compressor-format').locator('.c-select-input').click();
    await page.getByTestId('video-compressor-format').locator('.c-select-dropdown-option', { hasText: 'WebM' }).click();

    await page.getByTestId('video-compressor-upload').locator('input[type="file"]').setInputFiles('src/tools/video-compressor/fixtures/sample.webm');

    const job = page.getByTestId('video-job');
    await expect(job).toHaveCount(1);
    await expect(job).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
    await expect(job).toContainText('sample.webm');
    await expect(job).toContainText('160×120');
    await expect(job.getByRole('button', { name: 'Download' })).toBeVisible();
    await expect(page.getByTestId('video-compressor-total')).toBeVisible();
  });
});
