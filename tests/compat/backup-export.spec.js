import { expect, test } from '@playwright/test';
import { validateBackupEnvelope } from '../../js/domain/backup-envelope.js';
import { QUOTE_LIBRARY_STORES } from '../../js/domain/storage-contract.js';

async function readDownloadText(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function captureStoredState(page) {
  return page.evaluate(async () => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    try {
      const quoteDatabase = await repository.exportSnapshot();
      const local = Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]);
      const session = Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)]);
      return { quoteDatabase, local, session };
    } finally {
      await repository.close();
    }
  });
}

async function seedSavedQuote(page) {
  await page.locator('#customerName').fill('Backup Export Company');
  await page.locator('#itemName').fill('Unicode carton 📦');
  await page.locator('#quantity').fill('12');
  await page.locator('#unitCost').fill('1.23456');
  await page.locator('#price').fill('2.34567');
  await page.locator('#itemSubmit').click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#addCurrentToLibrary').click();
  await expect(page.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft');
  await page.evaluate(() => localStorage.setItem('unrelated-origin-key', 'must-not-export'));
}

test('downloads and revalidates a complete sensitive backup without changing stored data', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('#exportWorkspace')).toBeVisible();
  await expect(page.getByRole('note', { name: 'Sensitive backup warning' })).toContainText('unencrypted');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadCompleteBackup').click();
  const download = await downloadPromise;
  const text = await readDownloadText(download);
  const backup = JSON.parse(text);
  const expectedFilename = `gtm-calc-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`;

  expect(download.suggestedFilename()).toBe(expectedFilename);
  expect(await validateBackupEnvelope(backup)).toEqual({ valid: true, errors: [] });
  expect(Object.keys(backup.payload.quoteDatabase.stores).sort()).toEqual(Object.values(QUOTE_LIBRARY_STORES).sort());
  expect(backup.payload.quoteDatabase.stores.quotes).toHaveLength(1);
  expect(backup.payload.quoteDatabase.stores.customers).toHaveLength(1);
  expect(text).toContain('Backup Export Company');
  expect(text).toContain('1.23456');
  expect(backup.payload.localStorage.entries.map(({ key }) => key)).toContain('gtm_quote_calculator_v1');
  expect(backup.payload.localStorage.entries.map(({ key }) => key)).not.toContain('unrelated-origin-key');
  expect(text).not.toContain('gtm_quote_library_active_v1');
  await expect(page.locator('#backupStatus')).toContainText(`Download requested: ${expectedFilename}`);
  await expect(page.locator('#backupFileSize')).toContainText(`(${Buffer.byteLength(text, 'utf8')} bytes)`);
  await expect(page.locator('#downloadCompleteBackup')).toBeEnabled();
  await expect(page.locator('#exportWorkspace')).not.toHaveAttribute('aria-busy', 'true');
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(before);

  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await expect(page.locator('#customerName')).toHaveValue('Backup Export Company');
});

test('reports a local download failure without changing data and supports retry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const before = await captureStoredState(page);
  let downloadCount = 0;
  page.on('download', () => { downloadCount += 1; });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.evaluate(() => {
    window.__backupCreateObjectUrl = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error('synthetic blocked download'); };
  });

  await page.locator('#downloadCompleteBackup').click();
  await expect(page.locator('#backupStatus')).toContainText('could not be prepared or downloaded');
  await expect(page.locator('#downloadCompleteBackup')).toBeEnabled();
  expect(downloadCount).toBe(0);
  expect(await captureStoredState(page)).toEqual(before);

  await page.evaluate(() => { URL.createObjectURL = window.__backupCreateObjectUrl; });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadCompleteBackup').evaluate((button) => {
    button.click();
    button.click();
  });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^gtm-calc-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#backupStatus')).toContainText('Download requested');
  expect(downloadCount).toBe(1);
});

test('announces its busy state and supports keyboard download activation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'One engine is sufficient for the controlled in-flight UI state.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.evaluate(() => {
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    let releaseDigest;
    const gate = new Promise((resolve) => { releaseDigest = resolve; });
    window.__releaseBackupDigest = releaseDigest;
    crypto.subtle.digest = async (...args) => {
      await gate;
      return originalDigest(...args);
    };
  });

  const button = page.locator('#downloadCompleteBackup');
  await button.focus();
  const downloadPromise = page.waitForEvent('download');
  await button.press('Enter');
  await expect(button).toBeDisabled();
  await expect(page.locator('#exportWorkspace')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#backupStatus')).toContainText('Preparing a complete backup');

  await page.evaluate(() => window.__releaseBackupDigest());
  await downloadPromise;
  await expect(button).toBeEnabled();
  await expect(page.locator('#exportWorkspace')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#backupStatus')).toContainText('Download requested');
});
