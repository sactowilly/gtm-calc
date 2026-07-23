import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('loads, exposes accessible controls, and preserves approved defaults', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'GTM Calc and Quote Tool' })).toBeVisible();
  await expect(page.locator('#appVersion')).toContainText('v2.0.0 · navigation.2');
  await expect(page.getByRole('button', { name: 'New Quote' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Quote' })).toBeVisible();
  await page.locator('.quote-details').evaluate((details) => { details.open = true; });
  await expect(page.locator('#shipVia')).toHaveValue('Our Truck');
  await expect(page.locator('#fobPoint')).toHaveValue('Sacramento');
  await expect(page.locator('#terms')).toHaveValue('NET30');
});

test('quarantines a corrupt saved quote without losing its raw data', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gtm_quote_calculator_v1', '{broken'));
  await page.goto('./');
  await expect(page.locator('#statusMessage')).toContainText('recovery copy was preserved');
  const recovery = await page.evaluate(() => Object.keys(localStorage).find((key) => key.startsWith('gtm_quote_calculator_v1_recovery_')));
  expect(recovery).toBeTruthy();
});

test('has no serious accessibility violations or undersized primary controls', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact))).toEqual([]);

  const undersized = await page.locator('button').evaluateAll((buttons) => buttons
    .filter((button) => {
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
    })
    .map((button) => button.id || button.textContent.trim()));
  expect(undersized).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
