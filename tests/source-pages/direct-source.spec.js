import { expect, test } from '@playwright/test';
import { APP_BUILD_LABEL } from '../../js/app-meta.js';

test('runs the untransformed GitHub Pages source tree at the repository base path', async ({ page }) => {
  const browserErrors = [];
  const missingResources = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) missingResources.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  await expect(page.locator('#appVersion')).toHaveText(APP_BUILD_LABEL);
  await expect(page.locator('#appNavigation [aria-current="page"]')).toHaveCount(1);
  await page.locator('#customerName').fill('Direct Source Customer');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#addCurrentToLibrary').click();
  await expect(page.locator('#quoteLibraryStatus')).toContainText('unnumbered draft');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('#backupExportHeading')).toHaveText('Backup & Export');
  await expect(page.locator('#backupRestoreFile')).toBeVisible();
  await expect(page.locator('#inspectBackup')).toBeDisabled();

  await page.reload();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.locator('.library-card h3')).toHaveText('Direct Source Customer');
  expect(browserErrors).toEqual([]);
  expect(missingResources).toEqual([]);
});
