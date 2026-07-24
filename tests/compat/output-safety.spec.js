import { expect, test } from '@playwright/test';

async function downloadPdf(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function addSentinelItem(page) {
  await page.locator('#itemName').fill('Output safety carton');
  await page.locator('#quantity').fill('1');
  await page.locator('#unitCost').fill('9137.42');
  await page.locator('#price').fill('12000');
  await page.locator('#freight').fill('19.91');
  await page.getByRole('button', { name: 'Add Item' }).click();
}

test('regenerates a cached PDF after quote content changes', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('./');
  await page.locator('#customerName').fill('First PDF Customer');
  await addSentinelItem(page);
  await page.getByRole('button', { name: 'View Quote' }).click();
  await expect(page.locator('#pdfStatus')).toContainText('PDF ready', { timeout: 30000 });

  const firstPdf = await downloadPdf(page);
  await page.evaluate(() => {
    const customer = document.getElementById('customerName');
    customer.value = 'Second PDF Customer';
    customer.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(page.locator('#quotePdf')).not.toHaveAttribute('src');
  const secondPdf = await downloadPdf(page);
  expect(firstPdf.equals(secondPdf)).toBe(false);
});

test('keeps dialog clipboard text customer-safe while labeling internal copy', async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedQuoteText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedQuoteText = String(value);
        },
        readText: async () => window.__copiedQuoteText
      }
    });
  });
  await page.goto('./');
  await page.locator('#customerName').fill('Clipboard Safety Customer');
  await addSentinelItem(page);

  await page.getByRole('button', { name: 'Copy Internal', exact: true }).click();
  const internalText = await page.evaluate(() => navigator.clipboard.readText());
  expect(internalText).toContain('Total Cost');
  expect(internalText).toContain('$9,157.33');

  await page.getByRole('button', { name: 'View Quote' }).click();
  await expect(page.locator('#pdfStatus')).toContainText('PDF ready', { timeout: 30000 });
  await page.getByRole('button', { name: 'Copy Customer Quote', exact: true }).click();
  const customerText = await page.evaluate(() => navigator.clipboard.readText());

  expect(customerText).toContain('Clipboard Safety Customer');
  expect(customerText).toContain('$12,000');
  expect(customerText).not.toMatch(/Total Cost|Total GTM|Cost:|GTM/);
  expect(customerText).not.toContain('$9,157.33');
});
