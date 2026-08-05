import { expect, test } from '@playwright/test';

test.describe('Version 2.5 reporting exports in supported browsers', () => {
  test('keeps RFC 4180 quoting, formula protection, Unicode, and deterministic names in-browser', async ({ page }) => {
    const outbound = [];
    page.on('request', (request) => {
      if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
    });
    await page.goto('./');

    const result = await page.evaluate(async () => {
      const { serializeCsv, createExportFilename, formatExportMoney } = await import('/gtm-calc/js/domain/export-formatters.js');
      const csv = serializeCsv([
        ['Company', 'Notes', 'Empty'],
        ['=Injected 📦', 'A, "quoted"\r\nline', '']
      ]);
      return {
        csv,
        filename: createExportFilename('GTM Calc Quotes', 'csv', { date: '2026-08-05T12:00:00.000Z' }),
        money: formatExportMoney(1.234567)
      };
    });

    expect(result.csv).toBe('"Company","Notes","Empty"\r\n"\'=Injected 📦","A, ""quoted""\r\nline",""\r\n');
    expect(result.filename).toBe('gtm-calc-quotes-2026-08-05.csv');
    expect(result.money).toBe('1.23457');
    expect(outbound).toEqual([]);
  });

  test('customer and manual CSV projections remain reporting-only and preserve blank fields', async ({ page }) => {
    await page.goto('./');
    const result = await page.evaluate(async () => {
      const { buildCustomerCsv, buildManualItemsCsv } = await import('/gtm-calc/js/services/quote-export-service.js');
      return {
        customers: buildCustomerCsv([
          { id: 'customer-1', companyName: 'Acme, "North" 📦', addressText: '1 Main St\nSuite 2', defaultPaymentTerms: '', updatedAt: '' }
        ], { contacts: [{ customerId: 'customer-1', name: '@Buyer', email: '', phone: '' }] }),
        manual: buildManualItemsCsv([
          { sku: '=SKU-1', name: 'Manual Item', description: 'Line A\r\nLine B', unitOfMeasure: 'EA', dimensionsDisplay: '', active: true, updatedAt: '' }
        ])
      };
    });
    expect(result.customers).toContain('"Acme, ""North"" 📦","1 Main St\nSuite 2","\'@Buyer"');
    expect(result.manual).toContain('"\'=SKU-1","Manual Item","Line A\r\nLine B","EA","","Yes","undated"');
    expect(`${result.customers}\n${result.manual}`).not.toMatch(/unitCost|landed|gtm|margin|internalNotes/i);
  });

  test('individual JSON export retains a draft’s local data and excludes unrelated records', async ({ page }) => {
    await page.goto('./');
    const result = await page.evaluate(async () => {
      const { buildQuoteItem } = await import('/gtm-calc/js/domain/calculations.js');
      const { legacyQuoteToQuoteContent } = await import('/gtm-calc/js/domain/quote-library.js');
      const { buildIndividualQuoteJson } = await import('/gtm-calc/js/services/quote-export-service.js');
      const { item } = buildQuoteItem({ name: 'JSON carton', quantity: '10', uom: 'EA', unitCost: '1.2', price: '2.5', freight: '0', freightMode: 'perItem' }, 'line-1');
      const content = legacyQuoteToQuoteContent({ customerName: 'JSON Browser Customer', date: '2026-08-05', items: [item] });
      const quote = {
        id: 'quote-browser-1',
        schemaVersion: 1,
        originDeviceId: 'device-browser-1',
        currentStatus: 'draft',
        draftRevision: 0,
        versionIds: [],
        createdAt: '2026-08-05T12:00:00.000Z',
        updatedAt: '2026-08-05T12:00:00.000Z',
        customerSearchText: 'json browser customer',
        workingDraft: { kind: 'base', content }
      };
      const parsed = JSON.parse(buildIndividualQuoteJson(quote));
      return { parsed, quote };
    });
    expect(result.parsed.format).toBe('gtm-calc-quote-export');
    expect(result.parsed.quote.content.customer.companyName).toBe('JSON Browser Customer');
    expect(result.parsed.quote.content.lines[0].unitCost).toBe(1.2);
    expect(result.parsed).not.toHaveProperty('customers');
    expect(result.parsed).not.toHaveProperty('contacts');
    expect(result.parsed).not.toHaveProperty('backup');
  });

  test('Export workspace exposes local CSV report actions and reports requested downloads', async ({ page }) => {
    const outbound = [];
    page.on('request', (request) => {
      if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) outbound.push(request.url());
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.locator('#exportQuoteListCsv')).toBeVisible();
    await expect(page.locator('#exportCustomersCsv')).toBeVisible();
    await expect(page.locator('#exportManualItemsCsv')).toBeVisible();

    for (const [id, prefix] of [
      ['exportQuoteListCsv', 'gtm-calc-quotes-'],
      ['exportCustomersCsv', 'gtm-calc-customers-'],
      ['exportManualItemsCsv', 'gtm-calc-manual-items-']
    ]) {
      const downloadPromise = page.waitForEvent('download');
      await page.locator(`#${id}`).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(new RegExp(`^${prefix}\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    }
    await expect(page.locator('#quoteExportStatus')).toContainText('export requested');
    expect(outbound).toEqual([]);
  });
});
