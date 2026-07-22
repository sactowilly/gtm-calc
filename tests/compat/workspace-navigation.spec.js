import { expect, test } from '@playwright/test';

async function openWorkspace(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
}

test('keeps an active quote intact while switching mobile workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('#quoteWorkspace')).toBeVisible();
  await expect(page.locator('#quotesWorkspace')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Quote', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.locator('#customerName').fill('Workspace Packaging');
  await page.locator('#itemName').fill('Foam insert');
  await openWorkspace(page, 'Quotes');
  await expect(page.locator('#quotesWorkspace')).toBeVisible();
  await expect(page.locator('#quoteWorkspace')).toBeHidden();

  await openWorkspace(page, 'Customers');
  await expect(page.locator('#customersWorkspace')).toBeVisible();
  await openWorkspace(page, 'Catalog');
  await expect(page.locator('#catalogWorkspace')).toBeVisible();
  await openWorkspace(page, 'Quote');

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
