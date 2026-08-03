import { expect, test } from '@playwright/test';

async function openWorkspace(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function expectCurrentWorkspace(page, name, view) {
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#appNavigation [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator(`[data-app-view-panel="${view}"]`)).toBeVisible();
}

async function expectWithinViewport(locator) {
  expect(await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 &&
      bounds.left >= 0 &&
      bounds.bottom <= window.innerHeight &&
      bounds.right <= window.innerWidth;
  })).toBe(true);
}

test('keeps an active quote intact while switching mobile workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('#quotesWorkspace')).toBeHidden();
  await expectCurrentWorkspace(page, 'Quote', 'quote');
  await expect(page.locator('.quote-details')).not.toHaveAttribute('open', '');

  await page.locator('#customerName').fill('Workspace Packaging');
  await page.locator('#itemName').fill('Foam insert');
  await openWorkspace(page, 'Library');
  await expectCurrentWorkspace(page, 'Library', 'quotes');
  await expect(page.locator('#quoteWorkspace')).toBeHidden();
  await expect(page.locator('#quoteLibraryTools')).toHaveAttribute('open', '');

  await openWorkspace(page, 'Customers');
  await expectCurrentWorkspace(page, 'Customers', 'customers');
  await openWorkspace(page, 'Catalog');
  await expectCurrentWorkspace(page, 'Catalog', 'catalog');
  await openWorkspace(page, 'Quote');
  await expectCurrentWorkspace(page, 'Quote', 'quote');

  await expect(page.locator('#customerName')).toHaveValue('Workspace Packaging');
  await expect(page.locator('#itemName')).toHaveValue('Foam insert');
  await expect(page.locator('.quote-details')).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('preserves the chosen quote-details disclosure state across workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const quoteDetails = page.locator('.quote-details');
  await expect(quoteDetails).not.toHaveAttribute('open', '');

  await quoteDetails.locator('summary').click();
  await expect(quoteDetails).toHaveAttribute('open', '');
  await openWorkspace(page, 'Catalog');
  await expect(page.locator('#catalogTools')).toHaveAttribute('open', '');
  await openWorkspace(page, 'Quote');
  await expect(quoteDetails).toHaveAttribute('open', '');

  await quoteDetails.locator('summary').click();
  await expect(quoteDetails).not.toHaveAttribute('open', '');
  await openWorkspace(page, 'Customers');
  await expect(page.locator('#customerLibraryTools')).toHaveAttribute('open', '');
  await openWorkspace(page, 'Quote');
  await expect(quoteDetails).not.toHaveAttribute('open', '');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(quoteDetails).not.toHaveAttribute('open', '');
  await quoteDetails.locator('summary').click();
  await openWorkspace(page, 'Library');
  await openWorkspace(page, 'Quote');
  await expect(quoteDetails).toHaveAttribute('open', '');
});

test('reveals and focuses Buyer Email when the collapsed field is required', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const quoteDetails = page.locator('.quote-details');
  await expect(quoteDetails).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Email Customer', exact: true }).click();

  await expect(quoteDetails).toHaveAttribute('open', '');
  await expect(page.locator('#buyerEmail')).toBeFocused();
  await expectWithinViewport(page.locator('#buyerEmail'));
  await expect(page.locator('#statusMessage')).toContainText('Add Buyer Email');
});

test('keeps missing-email guidance inside the PDF dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  const quoteDetails = page.locator('.quote-details');
  const quoteDialog = page.locator('#quoteDialog');
  await expect(quoteDetails).not.toHaveAttribute('open', '');
  await page.locator('#viewQuote').click();
  await expect(quoteDialog).toBeVisible();
  await expect(page.locator('#pdfStatus')).toContainText('PDF ready', { timeout: 30000 });
  await page.locator('#emailCustomerDialog').click();

  await expect(quoteDialog).toBeVisible();
  await expect(page.locator('#pdfStatus')).toContainText('Add Buyer Email');
  await expect(quoteDetails).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.activeElement?.closest('#quoteDialog') !== null)).toBe(true);
});

test('uses a bottom navigation bar on a phone and a left navigation rail on a laptop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const phoneLayout = await page.locator('#appNavigation').evaluate((navigation) => {
    const style = getComputedStyle(navigation);
    return { position: style.position, bottom: style.bottom };
  });
  expect(phoneLayout).toEqual({ position: 'fixed', bottom: '0px' });

  await page.setViewportSize({ width: 1280, height: 900 });
  const laptopLayout = await page.locator('#appNavigation').evaluate((navigation) => {
    const style = getComputedStyle(navigation);
    return { position: style.position, columns: style.gridTemplateColumns };
  });
  expect(laptopLayout.position).toBe('sticky');
  expect(laptopLayout.columns.split(' ').length).toBe(1);
});

test('fits narrow labels, yields sticky actions while editing, and delays the desktop table', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./');
  const clippedLabels = await page.locator('#appNavigation button').evaluateAll((buttons) => buttons
    .filter((button) => button.scrollWidth > button.clientWidth)
    .map((button) => button.textContent.trim()));
  expect(clippedLabels).toEqual([]);
  const clippedQuoteActions = await page.locator('.quote-actions button').evaluateAll((buttons) => buttons
    .filter((button) => button.scrollWidth > button.clientWidth || button.scrollHeight > button.clientHeight)
    .map((button) => button.textContent.trim()));
  expect(clippedQuoteActions).toEqual([]);
  await expect(page.locator('.item-actions')).toHaveCSS('position', 'static');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#itemName').focus();
  await expect(page.locator('.item-actions')).toHaveCSS('position', 'static');

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator('.quote-table tbody')).toHaveCSS('display', 'block');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.quote-table tbody')).toHaveCSS('display', 'table-row-group');
});
