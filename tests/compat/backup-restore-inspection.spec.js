import { expect, test } from '@playwright/test';

const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

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
  await page.locator('#customerName').fill('Restore Inspection Customer');
  await page.locator('#itemName').fill('Restore inspection carton');
  await page.locator('#quantity').fill('12');
  await page.locator('#unitCost').fill('1.23456');
  await page.locator('#price').fill('2.34567');
  await page.locator('#itemSubmit').click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#addCurrentToLibrary').click();
  await expect(page.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft');
}

async function createBackupFixture(page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadCompleteBackup').click();
  return readDownloadText(await downloadPromise);
}

async function chooseBackupFile(page, file) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#backupRestoreFile').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

async function chooseBackupFileDirectly(page, file) {
  // Playwright uses the browser's file-input protocol for the retry path after a cancelled chooser.
  await page.locator('#backupRestoreFile').setInputFiles(file);
}

async function changeCurrentQuoteEventWithoutChangingItsId(page) {
  return page.evaluate(async () => {
    const [{ openDB }, { QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION, QUOTE_LIBRARY_STORES }] = await Promise.all([
      import('/gtm-calc/vendor/idb.js'),
      import('/gtm-calc/js/domain/storage-contract.js')
    ]);
    const database = await openDB(QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION);
    try {
      const transaction = database.transaction(QUOTE_LIBRARY_STORES.quoteEvents, 'readwrite');
      const event = (await transaction.store.getAll())[0];
      if (!event) throw new Error('Expected a saved quote event for the immutable conflict fixture.');
      event.metadata = { auditReason: 'independently changed immutable event' };
      await transaction.store.put(event);
      await transaction.done;
    } finally {
      database.close();
    }
  });
}

function fixtureFile(text, name = 'restore-fixture.json') {
  return { name, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') };
}

async function chooseDeclaredOversizeFile(page) {
  await page.locator('#backupRestoreFile').evaluate((input, maximumBytes) => {
    const file = new File(['{}'], 'too-large.json', { type: 'application/json' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    // WebKit clones files when assigning FileList, so an instance-level size override
    // is discarded. Patch the native Blob getter only for this synthetic fixture.
    const descriptor = Object.getOwnPropertyDescriptor(Blob.prototype, 'size');
    if (!descriptor?.get) throw new Error('Expected Blob.size getter for oversize fixture.');
    window.__restoreInspectionSizeDescriptor = descriptor;
    Object.defineProperty(Blob.prototype, 'size', {
      configurable: true,
      get() {
        return this.name === 'too-large.json' ? maximumBytes + 1 : descriptor.get.call(this);
      }
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, MAX_BACKUP_FILE_BYTES);
}

async function restoreSyntheticFileSize(page) {
  await page.evaluate(() => {
    if (window.__restoreInspectionSizeDescriptor) {
      Object.defineProperty(Blob.prototype, 'size', window.__restoreInspectionSizeDescriptor);
      delete window.__restoreInspectionSizeDescriptor;
    }
  });
}

function assertSanitizedInspection(page, privateTerms) {
  return page.locator('#backupInspectionStatus, #backupInspectionReport').allTextContents().then((parts) => {
    const text = parts.join(' ');
    privateTerms.forEach((term) => expect(text).not.toContain(term));
  });
}

test('inspects a valid local backup selected through the file chooser without changing stored data', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  const fixtureText = await createBackupFixture(page);
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  await expect(page.locator('#backupInspectionReport')).toBeHidden();
  await expect(page.locator('#inspectBackup')).toBeDisabled();
  await chooseBackupFile(page, fixtureFile(fixtureText));
  await expect(page.locator('#inspectBackup')).toBeEnabled();
  await expect(page.locator('#backupInspectionStatus')).toContainText('Ready to inspect');

  await page.locator('#inspectBackup').click();
  await expect(page.locator('#backupInspectionStatus')).toContainText('Backup inspection passed');
  await expect(page.locator('#backupInspectionReport')).toBeVisible();
  await expect(page.locator('#backupInspectionFilename')).toHaveText('restore-fixture.json');
  await expect(page.locator('#backupInspectionSchemaVersion')).toHaveText('1');
  await expect(page.locator('#backupInspectionRecordCounts')).toContainText('1 quotes');
  await expect(page.locator('.backup-restore-unavailable')).toContainText('Merge and Replace');
  await assertSanitizedInspection(page, ['Restore Inspection Customer', '1.23456', '2.34567']);
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(before);
});

test('keeps inspection local for malformed, tampered, and over-25-MiB files, then recovers after a cancelled selection', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  const validFixture = await createBackupFixture(page);
  const tampered = JSON.parse(validFixture);
  tampered.payload.quoteDatabase.stores.quotes[0].customerName = 'Tampered Customer Secret';
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#backupRestoreFile').click();
  const cancelledChooser = await chooserPromise;
  await cancelledChooser.setFiles([]);
  await expect(page.locator('#inspectBackup')).toBeDisabled();

  for (const file of [
    fixtureFile('{not valid JSON', 'malformed.json'),
    fixtureFile(JSON.stringify(tampered), 'tampered.json')
  ]) {
    await chooseBackupFileDirectly(page, file);
    await expect(page.locator('#inspectBackup')).toBeEnabled();
    await page.locator('#inspectBackup').click();
    await expect(page.locator('#backupInspectionStatus')).toContainText('could not be inspected');
    await expect(page.locator('#backupInspectionReport')).toBeHidden();
    await assertSanitizedInspection(page, ['Restore Inspection Customer', 'Tampered Customer Secret', '1.23456', '2.34567']);
    await expect(page.locator('#inspectBackup')).toBeEnabled();
  }

  await chooseDeclaredOversizeFile(page);
  await expect(page.locator('#inspectBackup')).toBeEnabled();
  await page.locator('#inspectBackup').click();
  await expect(page.locator('#backupInspectionStatus')).toContainText('over the 25 MiB inspection limit');
  await expect(page.locator('#backupInspectionReport')).toBeHidden();
  await expect(page.locator('#inspectBackup')).toBeEnabled();
  await restoreSyntheticFileSize(page);

  await chooseBackupFileDirectly(page, fixtureFile(validFixture, 'retry-valid.json'));
  await page.locator('#inspectBackup').click();
  await expect(page.locator('#backupInspectionStatus')).toContainText('Backup inspection passed');
  await expect(page.locator('#backupInspectionFilename')).toHaveText('retry-valid.json');
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(before);
});

test('reports a same-ID changed quote event as a blocking future-merge conflict without showing event data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  const earlierBackup = await createBackupFixture(page);
  await changeCurrentQuoteEventWithoutChangingItsId(page);
  const before = await captureStoredState(page);
  const outbound = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
  });

  await chooseBackupFileDirectly(page, fixtureFile(earlierBackup, 'event-conflict.json'));
  await page.locator('#inspectBackup').click();
  await expect(page.locator('#backupInspectionStatus')).toContainText('Backup inspection passed');
  await expect(page.locator('#backupInspectionImmutableConflicts')).toHaveText('1');
  await expect(page.locator('#backupInspectionMergeAvailability')).toHaveText('Blocked by future-restore conflicts');
  await expect(page.locator('#backupInspectionConflictWarning')).toBeVisible();
  await expect(page.locator('#backupInspectionConflictWarning')).toContainText('blocking conflicts');
  await assertSanitizedInspection(page, [
    'Restore Inspection Customer',
    'independently changed immutable event',
    '1.23456',
    '2.34567'
  ]);
  expect(outbound).toEqual([]);
  expect(await captureStoredState(page)).toEqual(before);
});

test('announces an in-progress inspection, prevents duplicate activation, and restores controls after reading', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The controlled Blob read is covered once; regular inspection is exercised in every browser profile.');
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await seedSavedQuote(page);
  const validFixture = await createBackupFixture(page);
  await chooseBackupFile(page, fixtureFile(validFixture, 'busy-retry.json'));

  await page.evaluate(() => {
    const originalArrayBuffer = Blob.prototype.arrayBuffer;
    let releaseRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    window.__releaseRestoreInspectionRead = releaseRead;
    window.__restoreInspectionOriginalArrayBuffer = originalArrayBuffer;
    Blob.prototype.arrayBuffer = async function (...args) {
      await readGate;
      return originalArrayBuffer.apply(this, args);
    };
  });

  const inspect = page.locator('#inspectBackup');
  await inspect.focus();
  await inspect.press('Enter');
  await inspect.evaluate((button) => button.click());
  await expect(inspect).toBeDisabled();
  await expect(page.locator('#exportWorkspace')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#backupInspectionStatus')).toContainText('Reading the selected backup');

  await page.evaluate(() => window.__releaseRestoreInspectionRead());
  await expect(page.locator('#backupInspectionStatus')).toContainText('Backup inspection passed');
  await expect(inspect).toBeEnabled();
  await expect(page.locator('#exportWorkspace')).not.toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => { Blob.prototype.arrayBuffer = window.__restoreInspectionOriginalArrayBuffer; });
});
