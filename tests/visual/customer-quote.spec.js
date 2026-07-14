import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { customerQuoteFixtures, multiPageQuote, onePageQuote } from '../fixtures/customer-quotes.js';

const outputDirectory = resolve('output', 'pdf');

async function loadSavedQuote(page, quote) {
  await page.addInitScript((savedQuote) => {
    localStorage.setItem('gtm_quote_calculator_v1', JSON.stringify(savedQuote));
  }, quote);
  await page.goto('./');
}

async function downloadGeneratedPdf(page, filename) {
  await page.getByRole('button', { name: 'View Quote' }).click();
  await expect(page.locator('#pdfStatus')).toContainText('PDF ready', { timeout: 30000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  await download.saveAs(resolve(outputDirectory, filename));
}

async function renderTemplateForInspection(page, quote, prefix, captureScreenshots = true) {
  const pageCount = await page.evaluate(async ({ fixture }) => {
    const [{ toCustomerQuoteDocument }, { createQuotePrintPages }] = await Promise.all([
      import('/gtm-calc/js/pdf/customer-quote-document.js'),
      import('/gtm-calc/js/pdf/quote-template.js')
    ]);
    const logoUrl = '/gtm-calc/assets/vision-industrial-packaging-logo.png';
    const rendered = await createQuotePrintPages(toCustomerQuoteDocument(fixture), logoUrl);
    rendered.host.style.position = 'static';
    rendered.host.style.zIndex = '1';
    rendered.host.style.left = '0';
    document.querySelector('.app-shell').style.display = 'none';
    document.querySelector('#quoteDialog')?.remove();
    window.__quoteVisualRender = rendered;
    return rendered.pages.length;
  }, { fixture: quote });

  const pages = page.locator('.quote-print-page');
  await expect(pages).toHaveCount(pageCount);
  expect(pageCount).toBeGreaterThan(0);

  const assertions = await pages.evaluateAll((pageNodes) => pageNodes.map((pageNode) => ({
    overflow: pageNode.querySelector('.quote-print-page__inner').scrollHeight - pageNode.querySelector('.quote-print-page__inner').clientHeight,
    headings: Array.from(pageNode.querySelectorAll('.quote-print-items th')).map((node) => node.textContent),
    hasLogo: pageNode.querySelector('.quote-print-logo')?.naturalWidth > 0,
    hasNotes: Boolean(pageNode.querySelector('.quote-print-notes')),
    fieldOverlap: Array.from(pageNode.querySelectorAll('.quote-print-field')).some((field) => {
      const label = field.querySelector('.quote-print-field__label')?.getBoundingClientRect();
      const value = field.querySelector('.quote-print-field__value')?.getBoundingClientRect();
      return label && value ? label.right > value.left + 0.5 : false;
    }),
    text: pageNode.textContent.toLowerCase()
  })));

  assertions.forEach((assertion) => {
    expect(assertion.overflow).toBeLessThanOrEqual(1);
    expect(assertion.headings).toEqual(['MIN', 'DESCRIPTION', 'UNIT', 'UNIT PRICE', 'LEAD TIME']);
    expect(assertion.hasLogo).toBe(true);
    expect(assertion.fieldOverlap).toBe(false);
    expect(assertion.text).not.toMatch(/unit cost|landed cost|gtm|margin|vendor/);
  });

  expect(assertions.some((assertion) => assertion.hasNotes)).toBe(true);

  if (captureScreenshots) {
    for (let index = 0; index < pageCount; index += 1) {
      await pages.nth(index).screenshot({
        path: resolve(outputDirectory, `${prefix}-template-page-${index + 1}.png`)
      });
    }
  }

  return pageCount;
}

test.beforeAll(async () => {
  await mkdir(outputDirectory, { recursive: true });
});

test('new quote details use the approved defaults and matching multiline blocks', async ({ page }) => {
  await page.goto('./');
  await page.locator('.quote-details').evaluate((details) => { details.open = true; });

  await expect(page.locator('#leadTime')).toBeVisible();
  await expect(page.locator('#shipVia')).toHaveValue('Our Truck');
  await expect(page.locator('#fobPoint')).toHaveValue('Sacramento');
  await expect(page.locator('#terms')).toHaveValue('NET30');
  await expect(page.locator('#buyerFax')).toHaveCount(0);

  const multilineHeights = await page.locator('#customerAddress, #customerNotes').evaluateAll((fields) => (
    fields.map((field) => field.getBoundingClientRect().height)
  ));
  expect(multilineHeights).toHaveLength(2);
  expect(Math.abs(multilineHeights[0] - multilineHeights[1])).toBeLessThanOrEqual(1);
});

test('one-page quotation renders and downloads without internal data', async ({ page }) => {
  await loadSavedQuote(page, onePageQuote);
  await downloadGeneratedPdf(page, 'vision-quotation-one-page.pdf');
  const pageCount = await renderTemplateForInspection(page, onePageQuote, 'vision-quotation-one-page');
  expect(pageCount).toBe(1);
});

test('multi-page quotation repeats its table header and stays within page bounds', async ({ page }) => {
  await loadSavedQuote(page, multiPageQuote);
  await downloadGeneratedPdf(page, 'vision-quotation-multi-page.pdf');
  const pageCount = await renderTemplateForInspection(page, multiPageQuote, 'vision-quotation-multi-page');
  expect(pageCount).toBeGreaterThanOrEqual(2);
});

for (const [fixtureName, fixture] of Object.entries(customerQuoteFixtures)) {
  test(`layout fixture ${fixtureName} has no page or field overflow`, async ({ page }) => {
    await page.goto('./');
    await renderTemplateForInspection(page, fixture, fixtureName, false);
  });
}
