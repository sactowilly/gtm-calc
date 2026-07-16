import { expect, test } from '@playwright/test';

async function openLibrary(page) {
  const library = page.locator('#quoteLibraryTools');
  if (!(await library.evaluate((element) => element.open))) {
    await library.locator('> summary').click();
  }
  return library;
}

async function createLibraryDraft(page, companyName = 'Lifecycle Customer') {
  await page.locator('#customerName').fill(companyName);
  await page.locator('.quote-details').evaluate((details) => { details.open = true; });
  await page.locator('#buyerName').fill('Jordan Buyer');
  await page.locator('#buyerEmail').fill('jordan@example.test');
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();
  await expect(library.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft');
  return library;
}

async function acceptNextDialog(page) {
  page.once('dialog', (dialog) => dialog.accept());
}

test('finalizes with a local number, opens read only, and follows terminal status rules', async ({ page }) => {
  await page.goto('./');
  const library = await createLibraryDraft(page);
  await acceptNextDialog(page);
  await library.getByRole('button', { name: 'Finalize' }).click();

  await expect(library.locator('#quoteLibraryStatus')).toContainText('Finalized as 2026-001');
  const card = library.locator('.library-card');
  await expect(card.locator('.library-card__number')).toHaveText('2026-001');
  await expect(card.locator('.library-card__status-badge')).toHaveText('Finalized');
  await expect(page.locator('#savedState')).toContainText('Finalized 2026-001');
  await expect(page.locator('#customerName')).toBeDisabled();
  await expect(page.locator('#itemSubmit')).toBeDisabled();
  await expect(page.locator('#saveQuote')).toBeDisabled();
  await expect(page.locator('#viewQuote')).toBeEnabled();

  const nextStatus = card.locator('.library-card__status-control select');
  await nextStatus.selectOption('sent');
  await card.getByRole('button', { name: 'Update Status' }).click();
  await expect(card.locator('.library-card__status-badge')).toHaveText('Sent');
  await expect(page.locator('#savedState')).toContainText('Sent 2026-001');

  await card.locator('.library-card__status-control select').selectOption('accepted');
  await card.getByRole('button', { name: 'Update Status' }).click();
  await expect(card.locator('.library-card__status-badge')).toHaveText('Accepted');
  await expect(card.locator('.library-card__status-control')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Create Revision' })).toHaveCount(0);

  await card.getByRole('button', { name: 'Duplicate' }).click();
  const duplicate = library.locator('.library-card').first();
  await expect(duplicate).toHaveClass(/is-unreviewed-duplicate/);
  await expect(duplicate.locator('.library-card__number')).toHaveText('Unnumbered');
  await expect(duplicate.locator('.library-card__status-badge')).toHaveText('Draft');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('creates and finalizes an editable revision without changing the prior version', async ({ page }) => {
  await page.goto('./');
  const library = await createLibraryDraft(page, 'Revision Customer');
  await acceptNextDialog(page);
  await library.getByRole('button', { name: 'Finalize' }).click();
  await expect(library.locator('#quoteLibraryStatus')).toContainText('Finalized as 2026-001');
  await acceptNextDialog(page);
  await library.getByRole('button', { name: 'Create Revision' }).click();

  await expect(page.locator('#savedState')).toContainText('Revision draft for 2026-001');
  await expect(page.locator('#customerName')).toBeEnabled();
  await page.locator('#customerName').fill('Revision Customer Updated');
  await page.locator('#saveQuote').click();
  await expect(page.locator('#statusMessage')).toContainText('Draft saved to the quote library');
  await acceptNextDialog(page);
  await library.getByRole('button', { name: 'Finalize' }).click();
  await expect(library.locator('.library-card__number')).toHaveText('2026-001-R1');
  await expect(page.locator('#savedState')).toContainText('Finalized 2026-001-R1');

  const history = library.locator('.library-card__history');
  await expect(history.locator('summary')).toHaveText('Version history (2)');
  await history.evaluate((details) => { details.open = true; });
  await acceptNextDialog(page);
  await history.getByRole('button', { name: 'View 2026-001', exact: true }).click();
  await expect(page.locator('#savedState')).toContainText('Historical 2026-001');
  await expect(page.locator('#customerName')).toHaveValue('Revision Customer');

  expect(await page.evaluate(async () => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const quotes = await repository.searchQuotes({ query: 'Revision Customer' });
    const versions = await repository.listVersions(quotes[0].id);
    await repository.close();
    return versions.map((version) => ({
      number: version.displayNumber,
      company: version.content.customer.companyName
    }));
  })).toEqual([
    { number: '2026-001', company: 'Revision Customer' },
    { number: '2026-001-R1', company: 'Revision Customer Updated' }
  ]);
});

test('finalizing a different library card does not replace the active draft', async ({ page }) => {
  await page.goto('./');
  const library = await createLibraryDraft(page, 'Active Draft Customer');
  await page.evaluate(async () => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    await repository.createDraftFromLegacyQuote({
      customerName: 'Background Finalization Customer',
      date: '2026-07-16',
      shipVia: 'Our Truck',
      fobPoint: 'Sacramento',
      terms: 'NET30',
      items: []
    });
    await repository.close();
  });
  await library.locator('#quoteLibraryStatusFilter').selectOption('draft');

  const backgroundCard = library.locator('.library-card').filter({ hasText: 'Background Finalization Customer' });
  await expect(backgroundCard).toHaveCount(1);
  await acceptNextDialog(page);
  await backgroundCard.getByRole('button', { name: 'Finalize' }).click();
  await expect(library.locator('#quoteLibraryStatus')).toContainText('The active quote was kept');
  await expect(page.locator('#customerName')).toHaveValue('Active Draft Customer');
  await expect(page.locator('#customerName')).toBeEnabled();
  await expect(library.locator('#addCurrentToLibrary')).toHaveAttribute('data-bound-quote-id', /.+/);
});
