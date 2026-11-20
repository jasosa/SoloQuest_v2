import { expect, test } from '@playwright/test';
import { gotoQuest } from './helpers';

test.describe('Show room', () => {
  test('warns first, then draws a room dimmed with nothing in it; Undo takes it away', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await expect(page.locator('[data-layout-only]')).toHaveCount(0);
    await page.getByTestId('show-room-btn').click();
    await expect(page.getByTestId('show-room-warning')).toContainText('floor and walls only');
    await page.getByRole('button', { name: 'Choose a square' }).click();
    await expect(page.getByTestId('show-room-banner')).toBeVisible();
    const monstersBefore = await page.locator('[data-monster]').count();
    await page.locator('[data-pick-cell="12,9"]').click({ force: true });
    await expect(page.locator('[data-layout-only]')).toHaveCount(1);
    await expect(page.locator('[data-monster]')).toHaveCount(monstersBefore);
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(page.locator('[data-layout-only]')).toHaveCount(0);
  });

  test('a tap that shows nothing new keeps the tool open', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await page.getByTestId('show-room-btn').click();
    await page.getByRole('button', { name: 'Choose a square' }).click();
    // a square that is already on the map is refused with a message and no event
    await page.locator('[data-pick-cell="2,15"]').click({ force: true });
    await expect(page.getByTestId('show-room-banner')).toBeVisible();
  });
});
