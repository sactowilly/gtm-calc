import { expect, test } from '@playwright/test';

async function openLibrary(page) {
  const library = page.locator('#quoteLibraryTools');
  if (!(await library.evaluate((element) => element.open))) {
    await library.locator('> summary').click();
  }
  return library;
}

async function fillQuoteCustomer(page, name) {
  await page.locator('#customerName').fill(name);
  await page.locator('.quote-details').evaluate((details) => { details.open = true; });
  await page.locator('#buyerName').fill('Jordan Buyer');
  await page.locator('#buyerEmail').fill('jordan@example.test');
}

test('progressively reveals 50 drafts while search still covers the complete result set', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#quoteLibrarySummary')).toHaveText('0 quotes on this device');
  await page.evaluate(async () => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    let id = 0;
    let second = 0;
    const repository = createQuoteLibraryRepository({
      idFactory: () => `scale-${++id}`,
      now: () => new Date(Date.UTC(2026, 6, 16, 12, 0, second++)).toISOString()
    });
    for (let index = 1; index <= 50; index += 1) {
      await repository.createDraftFromLegacyQuote({
        customerName: `Scale Customer ${String(index).padStart(2, '0')}`,
        buyerName: `Buyer ${index}`,
        buyerEmail: `buyer${index}@example.test`,
        date: '2026-07-16',
        shipVia: 'Our Truck',
        fobPoint: 'Sacramento',
        terms: 'NET30',
        items: []
      });
    }
    await repository.close();
  });

  const library = await openLibrary(page);
  await library.locator('#quoteLibrarySearch').fill('Scale Customer');
  await expect(library.locator('.library-card')).toHaveCount(10);
  await expect(library.locator('.library-card h3').first()).toHaveText('Scale Customer 50');
  await expect(library.locator('#quoteLibrarySummary')).toHaveText('50 quotes · 10 shown');

  const showMore = library.locator('#showMoreQuotes');
  await expect(showMore).toBeVisible();
  expect((await showMore.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await showMore.click();
  await expect(library.locator('.library-card')).toHaveCount(20);
  await expect(library.locator('#quoteLibrarySummary')).toHaveText('50 quotes · 20 shown');

  await library.locator('#quoteLibrarySearch').fill('Scale Customer 01');
  await expect(library.locator('.library-card')).toHaveCount(1);
  await expect(library.locator('.library-card h3')).toHaveText('Scale Customer 01');
  await expect(library.locator('#quoteLibrarySummary')).toHaveText('1 quote · 1 shown');

  await library.locator('#quoteLibrarySearch').fill('Scale Customer');
  await expect(library.locator('.library-card')).toHaveCount(10);
  for (let click = 0; click < 4; click += 1) await showMore.click();
  await expect(library.locator('.library-card')).toHaveCount(50);
  await expect(showMore).toBeHidden();
  await expect(library.locator('#quoteLibrarySummary')).toHaveText('50 quotes · 50 shown');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('highlights a duplicate without changing the customer and clears DUP after its first save', async ({ page }) => {
  await page.goto('./');
  await fillQuoteCustomer(page, 'Acme Packaging');
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();
  await library.getByRole('button', { name: 'Duplicate' }).click();

  const duplicateCard = library.locator('.library-card').first();
  await expect(duplicateCard).toHaveClass(/is-unreviewed-duplicate/);
  await expect(duplicateCard.locator('h3')).toHaveText('Acme Packaging');
  await expect(duplicateCard.locator('.library-card__duplicate-badge')).toHaveText('DUP');
  await expect(duplicateCard.locator('.library-card__duplicate-badge')).toHaveAttribute('aria-label', 'Duplicate draft needs review');
  const duplicateId = await duplicateCard.getAttribute('data-quote-id');
  expect(duplicateId).toBeTruthy();

  expect(await page.evaluate(async (quoteId) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const duplicate = await repository.getQuote(quoteId);
    await repository.close();
    return {
      companyName: duplicate.workingDraft.content.customer.companyName,
      revision: duplicate.draftRevision,
      hasSource: Boolean(duplicate.sourceQuoteId)
    };
  }, duplicateId)).toEqual({ companyName: 'Acme Packaging', revision: 0, hasSource: true });

  page.once('dialog', (dialog) => dialog.accept());
  await duplicateCard.getByRole('button', { name: 'Open' }).click();
  await expect(library.locator('#addCurrentToLibrary')).toHaveAttribute('data-bound-quote-id', duplicateId);
  await expect(library.locator('#quoteLibraryStatus')).toContainText('Opened Acme Packaging');
  await page.locator('#saveQuote').click();
  await expect(page.locator('#statusMessage')).toContainText('Draft saved to the quote library');

  const reviewedCard = library.locator(`[data-quote-id="${duplicateId}"]`);
  await expect(reviewedCard).not.toHaveClass(/is-unreviewed-duplicate/);
  await expect(reviewedCard.locator('.library-card__duplicate-badge')).toHaveCount(0);
  await expect(reviewedCard.locator('h3')).toHaveText('Acme Packaging');
  await expect(library.locator('#quoteLibrarySummary')).toContainText('one open');
});
