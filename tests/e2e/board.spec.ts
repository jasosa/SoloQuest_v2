import { expect, test } from '@playwright/test';

for (const state of ['fog', 'partial', 'full']) {
  test(`board renders in state ${state}`, async ({ page }) => {
    await page.goto(`/?state=${state}&labels=1`);
    await expect(page.locator('#board')).toBeVisible();
    await page.screenshot({ path: `test-results/board-${state}.png` });
  });
}

test('full board draws walls and 22 room labels', async ({ page }) => {
  await page.goto('/?state=full&labels=1');
  await expect(page.locator('#board text')).toHaveCount(22);
  expect(await page.locator('#board > line').count()).toBeGreaterThan(100);
});

test('fog draws no explored squares', async ({ page }) => {
  await page.goto('/?state=fog');
  await expect(page.locator('#board > line')).toHaveCount(0);
});
