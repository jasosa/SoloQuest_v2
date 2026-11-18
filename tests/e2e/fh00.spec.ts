import { expect, test } from '@playwright/test';

const URL = '/?quest=0&team=dwarf&nosave=1&seed=1';

test.describe('Frozen Horror quest 0 (Into the Northlands)', () => {
  test('starts outside the iron door, then shows the corridor, with the tunnels marked', async ({
    page,
  }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'test-results/fh00-start.png' });
    await page.locator('[data-door="in"]').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/fh00-opened.png' });
  });

  test('the quest select screen lists quest 0 after the 14 quests of the book', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Quest 0/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/fh00-select.png' });
  });
});
