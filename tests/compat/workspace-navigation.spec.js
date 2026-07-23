import { expect, test } from '@playwright/test';

async function openWorkspace(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
}

async function expectCurrentWorkspace(page, name, view) {
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#appNavigation [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator(`[data-app-view-panel="${view}"]`)).toBeVisible();
}

test('keeps an active quote intact while switching mobile workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('#quotesWorkspace')).toBeHidden();
  await expectCurrentWorkspace(page, 'Quote', 'quote');

  await page.locator('#customerName').fill('Workspace Packaging');
  await page.locator('#itemName').fill('Foam insert');
  await openWorkspace(page, 'Library');
  await expectCurrentWorkspace(page, 'Library', 'quotes');
  await expect(page.locator('#quoteWorkspace')).toBeHidden();

  await openWorkspace(page, 'Customers');
  await expectCurrentWorkspace(page, 'Customers', 'customers');
  await openWorkspace(page, 'Catalog');
  await expectCurrentWorkspace(page, 'Catalog', 'catalog');
  await openWorkspace(page, 'Quote');
  await expectCurrentWorkspace(page, 'Quote', 'quote');

  await expect(page.locator('#customerName')).toHaveValue('Workspace Packaging');
  await expect(page.locator('#itemName')).toHaveValue('Foam insert');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
