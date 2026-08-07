import { expect, test } from '@playwright/test';
import { APP_BUILD_LABEL } from '../../js/app-meta.js';

test('serves the production artifact from /gtm-calc/ and preserves core local behavior', async ({ page }) => {
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
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/gtm-calc/manifest.webmanifest');
  const manifestResponse = await page.request.get('./manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe('/gtm-calc/');
  expect(manifest.scope).toBe('/gtm-calc/');
  for (const icon of manifest.icons) {
    expect((await page.request.get(`./${icon.src}`)).ok()).toBe(true);
  }
  const serviceWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const shellCache = await caches.open(cacheNames.find((name) => name.startsWith('gtm-calc-app-shell-')));
    const cachedPaths = (await shellCache.keys()).map((request) => new URL(request.url).pathname);
    return { scope: new URL(registration.scope).pathname, cacheNames, cachedPaths };
  });
  expect(serviceWorker).toMatchObject({ scope: '/gtm-calc/' });
  expect(serviceWorker.cacheNames).toContain('gtm-calc-app-shell-v1');
  expect(serviceWorker.cachedPaths).toContain('/gtm-calc/manifest.webmanifest');
  expect(serviceWorker.cachedPaths.join('\n')).not.toMatch(/(?:\.pdf(?:$|\?)|\/backup(?:\/|$)|mailto:)/i);
  await page.locator('#itemName').fill('Production carton');
  await page.locator('#quantity').fill('10');
  await page.locator('#unitCost').fill('1.25');
  await page.locator('#price').fill('2.5');
  await expect(page.locator('#orderTotal')).toHaveText('$0.00');
  await page.locator('#itemSubmit').click();
  await expect(page.locator('#orderTotal')).toHaveText('$25.00');
  await page.locator('#saveQuote').click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('#backupExportHeading')).toHaveText('Backup & Export');
  await expect(page.locator('#backupRestoreFile')).toBeVisible();
  await expect(page.locator('#inspectBackup')).toBeDisabled();
  await page.getByRole('button', { name: 'Quote', exact: true }).click();

  await page.reload();
  await expect(page.locator('#orderTotal')).toHaveText('$25.00');
  await expect(page.locator('#quoteItems')).toContainText('Production carton');
  expect(browserErrors).toEqual([]);
  expect(missingResources).toEqual([]);
});
