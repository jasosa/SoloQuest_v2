import { expect, test, type Page } from '@playwright/test';
import { gotoQuest } from './helpers';

const URL = '/?quest=frozen&team=dwarf&nosave=1&seed=1';
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);
const trap = (page: Page, id: string) => page.locator(`[data-trap="${id}"]`);

test.describe('Frozen Horror board features (dev fixture)', () => {
  test('the heroes start outside an iron door and see nothing else; opening it shows the corridor', async ({
    page,
  }) => {
    await gotoQuest(page, URL);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-edge-door="woodenExit"]')).toHaveCount(0);
    await expect(page.locator('[data-trap]')).toHaveCount(0);
    await door(page, 'in').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    // the whole bottom corridor is in sight: the exit door and every hazard mark show
    await expect(page.locator('[data-edge-door="woodenExit"]')).toHaveCount(1);
    await expect(page.locator('[data-trap]')).toHaveCount(5);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/frozen-edge-doors.png' });
  });

  test('the wandering monster trap springs and puts the monsters on the roster', async ({
    page,
  }) => {
    await gotoQuest(page, URL + '&open=in');
    await trap(page, 'wt').click();
    await page.getByRole('button', { name: 'Step onto it' }).click();
    await expect(page.getByText('Wandering monsters!')).toBeVisible();
    await expect(page.getByText(/Put on the board: 2 Goblin/)).toBeVisible();
  });

  test('a good jump over the ice slide shows its path', async ({ page }) => {
    await gotoQuest(page, URL + '&open=in');
    await expect(page.locator('[data-slide]')).toHaveCount(0);
    await trap(page, 'sl').click();
    await page.getByRole('button', { name: 'Jump over it' }).click();
    await page
      .getByRole('button', { name: /No skull|Landed|Safe/i })
      .first()
      .click();
    await expect(page.locator('[data-slide]')).toHaveCount(1);
  });
});
