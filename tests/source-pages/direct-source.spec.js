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
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/gtm-calc/manifest.webmanifest?v=2');
  const manifestResponse = await page.request.get('./manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe('/gtm-calc/');
  expect(manifest.scope).toBe('/gtm-calc/');
  const serviceWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const shellCache = await caches.open(cacheNames.find((name) => name.startsWith('gtm-calc-app-shell-')));
    const cachedPaths = (await shellCache.keys()).map((request) => new URL(request.url).pathname);
    return { scope: new URL(registration.scope).pathname, cacheNames, cachedPaths };
  });
  expect(serviceWorker).toMatchObject({ scope: '/gtm-calc/' });
  expect(serviceWorker.cacheNames).toContain('gtm-calc-app-shell-v2');
  expect(serviceWorker.cachedPaths).toContain('/gtm-calc/manifest.webmanifest');
  expect(serviceWorker.cachedPaths).toContain('/gtm-calc/js/main.js');
  expect(serviceWorker.cachedPaths).toContain('/gtm-calc/js/pwa/connectivity-status.js');
  expect(serviceWorker.cachedPaths).toContain('/gtm-calc/js/backup/backup-export-ui.js');
  expect(serviceWorker.cachedPaths.join('\n')).not.toMatch(/(?:\.pdf(?:$|\?)|mailto:)/i);
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

test('reopens the cached source shell offline while retaining local quote work', async ({ page, context }) => {
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cachedPaths = await page.evaluate(async () => {
    const cache = await caches.open('gtm-calc-app-shell-v2');
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths.filter((path) => path.includes('/backup/'))).toEqual([
    '/gtm-calc/js/backup/backup-export-ui.js',
    '/gtm-calc/js/backup/backup-restore-inspection-ui.js',
    '/gtm-calc/js/backup/quote-export-ui.js'
  ]);

  await page.locator('#customerName').fill('Offline Source Customer');
  await page.locator('#itemName').fill('Offline source carton');
  await page.locator('#quantity').fill('8');
  await page.locator('#unitCost').fill('1.25');
  await page.locator('#price').fill('2.5');
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  await page.locator('#saveManualItem').click();
  await expect(page.locator('#catalogStatus')).toContainText('Saved to My Items');
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await page.locator('#itemSubmit').click();
  await page.locator('#saveQuote').click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#addCurrentToLibrary').click();
  await expect(page.locator('#quoteLibraryStatus')).toContainText('unnumbered draft');

  // The worker controls a reload after the first successful online launch.
  await page.reload();
  await context.setOffline(true);
  await page.reload();

  expect({ browserErrors, failedRequests }).toEqual({ browserErrors: [], failedRequests: [] });
  await expect(page.locator('#connectionStatus')).toContainText('Offline');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.locator('.library-card h3')).toHaveText('Offline Source Customer');
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  await page.locator('#catalogSearch').fill('offline source');
  await expect(page.locator('[data-item-id^="manual:"]')).toContainText('Offline source carton');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const backupDownload = page.waitForEvent('download');
  await page.locator('#downloadCompleteBackup').click();
  expect((await backupDownload).suggestedFilename()).toMatch(/^gtm-calc-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await expect(page.locator('#quoteItems')).toContainText('Offline source carton');

  await page.locator('#itemName').fill('Offline second carton');
  await page.locator('#quantity').fill('4');
  await page.locator('#unitCost').fill('0.5');
  await page.locator('#price').fill('1');
  await page.locator('#itemSubmit').click();
  await expect(page.locator('#quoteItems')).toContainText('Offline second carton');
});
