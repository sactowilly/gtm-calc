import { expect, test } from '@playwright/test';

async function openLibrary(page) {
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const library = page.locator('#quoteLibraryTools');
  if (!(await library.evaluate((element) => element.open))) {
    await library.locator('> summary').click();
  }
  return library;
}

async function fillQuoteCustomer(page, name = 'Acme Packaging') {
  await page.locator('#customerName').fill(name);
  await page.locator('.quote-details').evaluate((details) => { details.open = true; });
  await page.locator('#customerAddress').fill('123 Market Street\nSacramento, CA 95814');
  await page.locator('#buyerName').fill('Jordan Buyer');
  await page.locator('#buyerEmail').fill('jordan@example.test');
  await page.locator('#buyerPhone').fill('916-555-0123');
}

test('adds, saves, reloads, duplicates, searches, and recalls a local draft customer', async ({ page }) => {
  await page.goto('./');
  await fillQuoteCustomer(page);
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();
  await expect(library.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft');
  await expect(library.locator('.library-card h3')).toHaveText('Acme Packaging');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gtm_quote_calculator_v1')).customerName)).toBe('Acme Packaging');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await page.locator('#customerName').fill('Acme Packaging Updated');
  await page.locator('#saveQuote').click();
  await expect(page.locator('#statusMessage')).toContainText('Draft saved to the quote library');
  await openLibrary(page);
  await library.locator('#quoteLibrarySearch').fill('updated');
  await expect(library.locator('.library-card h3')).toHaveText('Acme Packaging Updated');

  await page.reload();
  await expect(page.locator('#customerName')).toHaveValue('Acme Packaging Updated');
  const reopenedLibrary = await openLibrary(page);
  await reopenedLibrary.locator('#quoteLibrarySearch').fill('');
  await reopenedLibrary.getByRole('button', { name: 'Duplicate' }).click();
  await expect(reopenedLibrary.locator('.library-card')).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#newQuote').click();
  await expect(page.locator('#customerName')).toHaveValue('');
  await expect(page.locator('#statusMessage')).toContainText('previous library quote remains saved');
  await expect(reopenedLibrary.locator('.library-card')).toHaveCount(2);
  await page.locator('#itemName').fill('Unsaved item entry');
  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  const customerLibrary = page.locator('#customerLibraryTools');
  await customerLibrary.evaluate((details) => { details.open = true; });
  await customerLibrary.locator('#customerLibrarySearch').fill('Acme Packaging Updated');
  await customerLibrary.getByRole('button', { name: 'Use Customer' }).click();
  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('.quote-details')).toHaveAttribute('open', '');
  await expect(page.locator('#customerName')).toHaveValue('Acme Packaging Updated');
  await expect(page.locator('#buyerEmail')).toHaveValue('jordan@example.test');
  await expect(page.locator('#itemName')).toHaveValue('Unsaved item entry');
  await expect(page.locator('#customerName')).toBeFocused();
  await expect(page.locator('#statusMessage')).toContainText('applied');
});

test('protects unsaved customer details before applying a saved customer', async ({ page }) => {
  await page.goto('./');
  await fillQuoteCustomer(page, 'Saved Customer');
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();

  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#newQuote').click();
  await page.locator('#customerName').fill('Unsaved Customer');
  await page.locator('#buyerEmail').fill('unsaved@example.test');

  await page.getByRole('button', { name: 'Customers', exact: true }).click();
  const customerLibrary = page.locator('#customerLibraryTools');
  await customerLibrary.evaluate((details) => { details.open = true; });
  await customerLibrary.locator('#customerLibrarySearch').fill('Saved Customer');

  page.once('dialog', (dialog) => dialog.dismiss());
  await customerLibrary.getByRole('button', { name: 'Use Customer' }).click();
  await expect(page.locator('#customersWorkspace')).toBeVisible();
  await expect(customerLibrary.locator('#customerLibraryStatus')).toContainText('current quote details were kept');
  await expect(page.locator('#customerName')).toHaveValue('Unsaved Customer');
  await expect(page.locator('#buyerEmail')).toHaveValue('unsaved@example.test');

  page.once('dialog', (dialog) => dialog.accept());
  await customerLibrary.getByRole('button', { name: 'Use Customer' }).click();
  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('.quote-details')).toHaveAttribute('open', '');
  await expect(page.locator('#customerName')).toHaveValue('Saved Customer');
  await expect(page.locator('#customerName')).toBeFocused();
  await expect(page.locator('#statusMessage')).toContainText('Saved Customer applied');
});

test('warns instead of overwriting a library draft changed by another writer', async ({ page }) => {
  await page.goto('./');
  await fillQuoteCustomer(page, 'Conflict Test Customer');
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();
  await expect(library.locator('#quoteLibraryStatus')).toContainText('added as an unnumbered draft');
  const quoteId = await library.locator('#addCurrentToLibrary').getAttribute('data-bound-quote-id');
  expect(quoteId).toBeTruthy();

  await page.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const draft = await repository.getQuote(id);
    const content = structuredClone(draft.workingDraft.content);
    content.customer.companyName = 'Saved by Another Writer';
    await repository.saveDraftWithCustomer(id, content, { expectedRevision: draft.draftRevision });
    await repository.close();
  }, quoteId);

  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await page.locator('#buyerPhone').fill('916-555-9999');
  await page.locator('#saveQuote').click();
  await expect(page.locator('#statusMessage')).toContainText('changed in another tab');
  await expect(library.locator('#quoteLibraryStatus')).toContainText('changed in another tab');

  expect(await page.evaluate(async (id) => {
    const { createQuoteLibraryRepository } = await import('/gtm-calc/js/services/indexeddb-quote-repository.js');
    const repository = createQuoteLibraryRepository();
    const draft = await repository.getQuote(id);
    await repository.close();
    return draft.workingDraft.content.customer.companyName;
  }, quoteId)).toBe('Saved by Another Writer');
});

test('opening a saved quote collapses the library and scrolls to Active Quote', async ({ page }) => {
  await page.goto('./');
  await fillQuoteCustomer(page, 'Scroll Customer');
  const library = await openLibrary(page);
  await library.locator('#addCurrentToLibrary').click();

  await page.evaluate(() => window.scrollTo(0, 0));
  page.once('dialog', (dialog) => dialog.accept());
  await library.getByRole('button', { name: 'Open' }).click();

  await expect(library).not.toHaveAttribute('open', '');
  const scrollState = await page.locator('.quote-panel').evaluate((panel) => ({
    panelTop: panel.getBoundingClientRect().top,
    viewportHeight: window.innerHeight
  }));
  expect(scrollState.panelTop).toBeLessThanOrEqual(scrollState.viewportHeight);
  await expect(page.locator('#customerName')).toHaveValue('Scroll Customer');
  await expect(page.locator('#quote-heading')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Quote', exact: true })).toHaveAttribute('aria-current', 'page');
});
