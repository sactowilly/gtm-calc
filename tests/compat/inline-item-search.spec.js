import { expect, test } from '@playwright/test';

const csv = [
  'SKU,Name,Description,Dimensions,UOM,Unit Cost,Unit Price,Active',
  'RSC-12108,RSC Kraft Carton,32 ECT Kraft,12 x 10 x 8,CS,0.54321,1.25,yes',
  'TAPE-2,Two Inch Tape,Pressure sensitive tape,,EA,18.5,29.95,yes'
].join('\n');

async function importCatalog(page) {
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  const catalog = page.locator('#catalogTools');
  if (!(await catalog.evaluate((element) => element.open))) {
    await catalog.locator('> summary').click();
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#catalogFile').setInputFiles({
    name: 'vision-catalog.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv)
  });
  await expect(page.locator('#catalogStatus')).toContainText('Imported 2 items');
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
}

test('searches and selects catalog items from the Quote Item field without leaving the quote', async ({ page }) => {
  await page.goto('./');
  await importCatalog(page);

  const itemName = page.locator('#itemName');
  const inlineResults = page.locator('#inlineCatalogResults');
  await itemName.fill('12x10x8');
  await expect(inlineResults).toBeVisible();
  const carton = inlineResults.locator('[data-inline-item-id="catalog:RSC-12108"]');
  await expect(carton).toContainText('RSC Kraft Carton');
  await expect(carton).toContainText('RSC-12108');

  await itemName.press('ArrowDown');
  await expect(carton).toBeFocused();
  await carton.press('Enter');

  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('#catalogWorkspace')).toBeHidden();
  await expect(inlineResults).toBeHidden();
  await expect(itemName).toHaveValue('RSC Kraft Carton');
  await expect(page.locator('#uom')).toHaveValue('CS');
  await expect(page.locator('#unitCost')).toHaveValue('0.54321');
  await expect(page.locator('#price')).toHaveValue('1.25');
  await expect(page.locator('#quantity')).toBeFocused();

  await page.locator('#quantity').fill('10');
  await page.locator('#itemSubmit').click();
  await page.locator('#saveQuote').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gtm_quote_calculator_v1')));
  expect(stored.items[0]).toMatchObject({
    name: 'RSC Kraft Carton',
    catalogItemId: 'catalog:RSC-12108',
    catalogSource: 'catalog',
    sku: 'RSC-12108'
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('keeps manual item details until an inline selection is confirmed and gives a no-result fallback', async ({ page }) => {
  await page.goto('./');
  await importCatalog(page);

  await page.locator('#unitCost').fill('4.5');
  await page.locator('#price').fill('8');
  await page.locator('#leadTime').fill('Tomorrow');
  await page.locator('#itemName').fill('tape');
  const tape = page.locator('#inlineCatalogResults [data-inline-item-id="catalog:TAPE-2"]');
  await expect(tape).toBeVisible();

  page.once('dialog', (dialog) => dialog.dismiss());
  await tape.click();
  await expect(page.locator('#itemName')).toHaveValue('tape');
  await expect(page.locator('#unitCost')).toHaveValue('4.5');
  await expect(page.locator('#catalogSelection')).toContainText('current item details were kept');

  page.once('dialog', (dialog) => dialog.accept());
  await tape.click();
  await expect(page.locator('#itemName')).toHaveValue('Two Inch Tape');
  await expect(page.locator('#unitCost')).toHaveValue('18.5');
  await expect(page.locator('#price')).toHaveValue('29.95');

  await page.locator('#itemName').fill('not in this catalog');
  await expect(page.locator('#inlineCatalogResults')).toContainText('No matching catalog or My Items');
  await expect(page.locator('#catalogSelection')).toHaveText('');
});
