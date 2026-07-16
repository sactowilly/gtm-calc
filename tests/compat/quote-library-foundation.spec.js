import { expect, test } from '@playwright/test';

test('the IndexedDB foundation preserves the active localStorage quote while importing and numbering a copy', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(async () => {
    const legacyQuote = {
      customerName: 'Browser Foundation Test',
      customerAddress: '',
      buyerName: 'Test Buyer',
      buyerEmail: 'buyer@example.test',
      buyerPhone: '',
      salesRep: 'Test Rep',
      date: '2026-07-16',
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      terms: 'NET30',
      customerNotes: '',
      items: [{
        id: 'browser-line-1',
        name: 'Browser Test Item',
        quantity: 10,
        uom: 'EA',
        unitCost: 1,
        price: 2,
        freight: 0,
        freightMode: 'perItem',
        freightPerUnit: 0,
        landedUnitCost: 1,
        totalCost: 10,
        orderTotal: 20,
        gtmEachDollars: 1,
        gtmTotalDollars: 10,
        gtmEachPercent: 100,
        gtmTotalPercent: 100,
        leadTime: ''
      }]
    };
    const key = 'gtm_quote_calculator_v1';
    localStorage.setItem(key, JSON.stringify(legacyQuote));
    const originalRaw = localStorage.getItem(key);
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const databaseName = `gtm-browser-test-${crypto.randomUUID()}`;
    const repository = createQuoteLibraryRepository({ databaseName });
    try {
      const draft = await repository.createDraftFromLegacyQuote(legacyQuote);
      const version = await repository.finalizeBase(draft.id, { numberYear: 2026 });
      return {
        originalPreserved: localStorage.getItem(key) === originalRaw,
        draftWasUnnumbered: !draft.baseNumber,
        displayNumber: version.displayNumber,
        storedCompany: (await repository.getVersion(version.id)).content.customer.companyName
      };
    } finally {
      await repository.destroy();
    }
  });

  expect(result).toEqual({
    originalPreserved: true,
    draftWasUnnumbered: true,
    displayNumber: '2026-001',
    storedCompany: 'Browser Foundation Test'
  });
});
