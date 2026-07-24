import { expect, test } from '@playwright/test';

test('keeps healthy quotes usable while preserving damaged records for recovery', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const {
      QUOTE_LIBRARY_DATABASE_NAME,
      QUOTE_LIBRARY_DATABASE_VERSION,
      QUOTE_LIBRARY_STORES,
      createQuoteLibraryRepository
    } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    await repository.createDraftFromLegacyQuote({
      customerName: 'Healthy Recovery Customer',
      buyerName: 'Healthy Buyer',
      buyerEmail: 'healthy@example.test',
      date: '2026-07-24',
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      terms: 'NET30',
      items: []
    });
    await repository.close();

    const { openDB } = await import('/gtm-calc/vendor/idb.js');
    const database = await openDB(QUOTE_LIBRARY_DATABASE_NAME, QUOTE_LIBRARY_DATABASE_VERSION);
    await database.put(QUOTE_LIBRARY_STORES.quotes, {
      id: 'damaged-release-record',
      schemaVersion: 99,
      rawSentinel: 'PRESERVE-ME'
    });
    database.close();
  });

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('#quoteLibrarySearch').fill('Recovery');
  await expect(page.locator('.library-card h3')).toHaveText('Healthy Recovery Customer');
  await expect(page.locator('#quoteLibraryRecovery')).toBeVisible();
  await expect(page.locator('#quoteLibraryRecovery')).toContainText('1 damaged record preserved for recovery');
  await expect(page.locator('#quoteLibraryRecovery')).toContainText('Do not clear this site');
  await expect(page.getByRole('button', { name: /repair|purge|delete damaged/i })).toHaveCount(0);

  const preserved = await page.evaluate(async () => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const records = await repository.getRecoveryRecords();
    await repository.close();
    return records.find((record) => record.originalKey === 'damaged-release-record')?.rawRecord;
  });
  expect(preserved).toEqual({
    id: 'damaged-release-record',
    schemaVersion: 99,
    rawSentinel: 'PRESERVE-ME'
  });
});
