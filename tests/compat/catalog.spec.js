import { expect, test } from '@playwright/test';

const csv = [
  'SKU,Name,Description,Dimensions,UOM,Unit Cost,Unit Price,Active',
  'RSC-12108,RSC Kraft Carton,32 ECT Kraft,12 x 10 x 8,CS,0.54321,1.25,yes',
  'TAPE-2,Two Inch Tape,Pressure sensitive tape,,EA,18.5,29.95,yes'
].join('\n');

async function openCatalog(page) {
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  const catalog = page.locator('#catalogTools');
  if (!(await catalog.evaluate((element) => element.open))) {
    await catalog.locator('> summary').click();
  }
  return catalog;
}

test('imports, searches, selects, and snapshots a catalog item without changing the quote storage key', async ({ page }) => {
  await page.goto('./');
  await openCatalog(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#catalogFile').setInputFiles({
    name: 'vision-catalog.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });

  await expect(page.locator('#catalogStatus')).toContainText('Imported 2 items');
  await expect(page.locator('#catalogImportSummary')).toContainText('2 accepted · 0 rejected');
  await page.locator('#catalogSearch').fill('12x10x8');
  await page.locator('[data-item-id="catalog:RSC-12108"]').click();

  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('#catalogWorkspace')).toBeHidden();
  await expect(page.locator('#itemName')).toHaveValue('RSC Kraft Carton');
  await expect(page.locator('#uom')).toHaveValue('CS');
  await expect(page.locator('#unitCost')).toHaveValue('0.54321');
  await expect(page.locator('#price')).toHaveValue('1.25');
  await page.locator('#quantity').fill('10');
  await page.locator('#itemSubmit').click();
  await page.locator('#saveQuote').click();

  const stored = await page.evaluate(() => ({
    quote: JSON.parse(localStorage.getItem('gtm_quote_calculator_v1')),
    catalog: JSON.parse(localStorage.getItem('gtm_catalog_v1'))
  }));
  expect(stored.quote.items[0]).toMatchObject({
    name: 'RSC Kraft Carton',
    uom: 'CS',
    catalogItemId: 'catalog:RSC-12108',
    catalogSource: 'catalog',
    sku: 'RSC-12108'
  });
  expect(stored.catalog.items).toHaveLength(2);

  await page.reload();
  await openCatalog(page);
  await expect(page.locator('[data-item-id="catalog:RSC-12108"]')).toBeVisible();
});

test('saves, updates, and reloads a local My Item', async ({ page }) => {
  await page.goto('./');
  await page.locator('#itemName').fill('Custom Foam Set');
  await page.locator('#uom').selectOption('BND');
  await page.locator('#unitCost').fill('4.12345');
  await page.locator('#price').fill('8.5');
  await openCatalog(page);
  await page.locator('#saveManualItem').click();

  await expect(page.locator('#catalogStatus')).toContainText('Saved to My Items');
  await expect(page.locator('[data-item-id^="manual:"]')).toContainText('Custom Foam Set');
  await page.reload();
  await openCatalog(page);
  await page.locator('#catalogSearch').fill('custom foam');
  await expect(page.locator('[data-item-id^="manual:"]')).toContainText('MY ITEM');
});
