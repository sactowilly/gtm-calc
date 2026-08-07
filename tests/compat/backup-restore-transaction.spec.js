import { expect, test } from '@playwright/test';

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
      return {
        quoteDatabase: await repository.exportSnapshot(),
        local: Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
        session: Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])
      };
    } finally {
      await repository.close();
    }
  });
}

async function seedSavedQuote(page) {
  await page.locator('#customerName').fill('Private Restore Customer');
  await page.locator('#itemName').fill('Private restore carton');
  await page.locator('#quantity').fill('12');
  await page.locator('#unitCost').fill('1.23456');
  await page.locator('#price').fill('2.34567');
  await page.locator('#itemSubmit').click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#addCurrentToLibrary').click();
  await expect(page.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft', { timeout: 10000 });
}

async function createBackupFixture(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadCompleteBackup').click();
  return readDownloadText(await downloadPromise);
}

async function chooseBackup(page, text) {
  await page.locator('#backupRestoreFile').setInputFiles({
    name: 'synthetic-restore.json', mimeType: 'application/json', buffer: Buffer.from(text, 'utf8')
  });
  await page.locator('#inspectBackup').click();
  await expect(page.locator('#backupInspectionStatus')).toContainText('Backup inspection passed');
}

function privateRestoreText(page) {
  return page.locator([
    '#backupInspectionStatus', '#backupInspectionReport', '#backupRestoreAction', '#backupRestoreStatus', '#backupRestoreResult'
  ].join(', ')).allTextContents().then((parts) => parts.join(' '));
}

test('requires typed owner confirmation, requests a local safety backup, restores without UI privacy leakage, and stays responsive', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const isDesktop = testInfo.project.name === 'chromium' || testInfo.project.name === 'firefox' || testInfo.project.name === 'webkit';
  await page.setViewportSize(isDesktop ? { width: 1280, height: 800 } : { width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const fixture = await createBackupFixture(page);
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  await expect(page.locator('#backupRestoreAction')).toBeHidden();
  await chooseBackup(page, fixture);
  await expect(page.locator('#backupRestoreAction')).toBeVisible();
  await expect(page.locator('#restoreModeMerge')).toBeChecked();
  await expect(page.locator('#restoreBackup')).toBeDisabled();

  await page.locator('#backupRestoreConfirmation').fill('restore');
  await expect(page.locator('#restoreBackup')).toBeDisabled();
  await page.locator('#backupRestoreConfirmation').fill('RESTORE');
  await expect(page.locator('#restoreBackup')).toBeEnabled();

  await page.evaluate(() => {
    window.__restoreOriginalSetTimeout = window.setTimeout;
    window.setTimeout = (callback) => {
      window.__restoreReloadCallback = callback;
      return 1;
    };
  });
  const safetyDownload = page.waitForEvent('download');
  await page.locator('#restoreBackup').press('Enter');
  const download = await safetyDownload;
  expect(download.suggestedFilename()).toMatch(/^gtm-calc-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#backupRestoreStatus')).toContainText('Restore completed and was validated');
  await expect(page.locator('#backupRestoreResult')).toBeVisible();
  await expect(page.locator('#backupRestoreResultMode')).toHaveText('Merge');
  await expect(page.locator('#backupRestoreSafetyFilename')).toHaveText(download.suggestedFilename());
  await expect(page.locator('.app-header')).toHaveAttribute('inert', '');
  await expect(page.locator('.app-navigation')).toHaveAttribute('inert', '');
  await expect(page.locator('.app-views')).toHaveAttribute('inert', '');
  await expect(page.locator('#restoreBackup')).toBeDisabled();
  expect(await page.evaluate(() => typeof window.__restoreReloadCallback)).toBe('function');

  const visibleRestoreText = await privateRestoreText(page);
  expect(visibleRestoreText).not.toContain('Private Restore Customer');
  expect(visibleRestoreText).not.toContain('1.23456');
  expect(visibleRestoreText).not.toContain('2.34567');
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(before);

  const undersizedControls = await page.locator('#restoreBackup, .backup-restore-mode, #backupRestoreConfirmation').evaluateAll((controls) => controls
    .filter((control) => {
      const box = control.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
    })
    .map((control) => control.id));
  expect(undersizedControls).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('blocks a conflict during inspection without enabling restore or changing any local state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const fixture = JSON.parse(await createBackupFixture(page));
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  await page.evaluate(async () => {
    const [{ openDB }, { QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION, QUOTE_LIBRARY_STORES }] = await Promise.all([
      import('/gtm-calc/vendor/idb.js'),
      import('/gtm-calc/js/domain/storage-contract.js')
    ]);
    const database = await openDB(QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION);
    try {
      const transaction = database.transaction(QUOTE_LIBRARY_STORES.quoteEvents, 'readwrite');
      const event = (await transaction.store.getAll())[0];
      event.metadata = { privateReason: 'do not render this internal conflict value' };
      await transaction.store.put(event);
      await transaction.done;
    } finally {
      database.close();
    }
  });
  const changedBeforeInspection = await captureStoredState(page);

  await chooseBackup(page, JSON.stringify(fixture));
  await expect(page.locator('#backupInspectionConflictWarning')).toBeVisible();
  await expect(page.locator('#restoreModeMerge')).toBeDisabled();
  await expect(page.locator('#restoreModeReplace')).toBeDisabled();
  await expect(page.locator('#restoreBackup')).toBeDisabled();
  await expect(page.locator('#backupRestoreStatus')).toContainText('Restore remains unavailable');
  expect(await privateRestoreText(page)).not.toContain('do not render this internal conflict value');
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(changedBeforeInspection);
  expect(changedBeforeInspection).not.toEqual(before);
});
