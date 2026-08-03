import { expect, test } from '@playwright/test';

test('creates and revalidates a complete backup with real browser IndexedDB and Web Crypto', async ({ page }, testInfo) => {
  await page.goto('./');
  const result = await page.evaluate(async ({ suffix }) => {
    const [{ createQuoteLibraryRepository }, { createBackupService }, { validateBackupEnvelope }] = await Promise.all([
      import('/gtm-calc/js/services/indexeddb-quote-repository.js'),
      import('/gtm-calc/js/services/backup-service.js'),
      import('/gtm-calc/js/domain/backup-envelope.js')
    ]);
    const databaseName = `browser-backup-${suffix}-${crypto.randomUUID()}`;
    const repository = createQuoteLibraryRepository({ databaseName });
    const activeQuote = {
      customerName: 'Browser Backup Company',
      customerAddress: '', buyerName: '', buyerEmail: '', buyerPhone: '', salesRep: '',
      date: '2026-08-03', shipVia: 'Our Truck', fobPoint: 'Sacramento', terms: 'NET30', customerNotes: '',
      items: [{ name: 'Browser Carton', quantity: 10, uom: 'EA', unitCost: 1, price: 2, freight: 0, freightMode: 'perItem' }]
    };
    localStorage.setItem('gtm_quote_calculator_v1', JSON.stringify(activeQuote));
    try {
      await repository.createDraftFromLegacyQuote(activeQuote);
      const backup = await createBackupService({
        quoteRepository: repository,
        storage: localStorage,
        now: () => '2026-08-03T13:00:00.000Z'
      }).createBackup();
      const serialized = JSON.stringify(backup);
      const report = await validateBackupEnvelope(JSON.parse(serialized));
      return {
        report,
        checksum: backup.payloadChecksum,
        quoteCount: backup.payload.quoteDatabase.stores.quotes.length,
        localKeys: backup.payload.localStorage.entries.map(({ key }) => key),
        serializedLength: serialized.length
      };
    } finally {
      await repository.destroy();
      localStorage.clear();
    }
  }, { suffix: testInfo.project.name });

  expect(result.report).toEqual({ valid: true, errors: [] });
  expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(result.quoteCount).toBe(1);
  expect(result.localKeys).toContain('gtm_quote_calculator_v1');
  expect(result.serializedLength).toBeGreaterThan(500);
});
