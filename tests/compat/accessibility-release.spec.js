import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function expectNoSeriousViolations(page, state) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map((violation) => ({ id: violation.id, impact: violation.impact, state }));
  expect(serious).toEqual([]);
  await expect(page.locator('#appNavigation [aria-current="page"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('keeps every release workspace accessible on phone and laptop layouts', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  for (const name of ['Quote', 'Library', 'Customers', 'Catalog']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expectNoSeriousViolations(page, `phone-${name}`);
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Quote', exact: true }).click();
  await expectNoSeriousViolations(page, 'laptop-Quote');

  const undersized = await page.locator('#appNavigation button').evaluateAll((buttons) => buttons
    .filter((button) => {
      const box = button.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    })
    .map((button) => button.textContent.trim()));
  expect(undersized).toEqual([]);
});
