import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';

// Guides are added to tools over time, so the tool without one is looked up instead of hard-coded
const { tools } = parse(readFileSync('locales/en.yml', 'utf8')) as { tools: Record<string, { title?: string; guide?: unknown }> };
const [toolKeyWithoutGuide, toolWithoutGuide] = Object.entries(tools).find(([, tool]) => typeof tool?.title === 'string' && !tool.guide) ?? [];

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
    expect(toolKeyWithoutGuide, 'every tool has a guide, so this test needs a new approach').toBeDefined();
    await page.goto(`/${toolKeyWithoutGuide}`);

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

    await page.locator(`a[href="/${toolKeyWithoutGuide}"]`).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(toolWithoutGuide!.title!);
    await expect(page.getByTestId('tool-guide')).toHaveCount(0);
  });
});
