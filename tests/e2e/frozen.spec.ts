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

test('a room with a tile shows its name and rule in the room note', async ({ page }) => {
  await gotoQuest(page, URL + '&open=in,d1,d2');
  // a square of R17 (the ice vault) that has nothing on it
  await page.locator('[data-room-cell="8,16"]').click();
  const note = page.getByTestId('tile-rule').first();
  await expect(note).toContainText('Ice Vault');
  await expect(note).toContainText('roll 1 combat die');
  // the terrain in the room (an ice ledge) shows its rule too
  await expect(page.getByTestId('tile-rule').nth(1)).toContainText('Ice ledge');
});

test.describe('terrain and rule hints', () => {
  test('a terrain gives a reminder the first time it is seen, and its rule on a tap', async ({
    page,
  }) => {
    await gotoQuest(page, URL);
    await page.locator('[data-door="in"]').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Icy river: Each square of the river');
    await expect(page.locator('[data-board-tile="icyRiver"]')).toHaveCount(1);
    // a tap on a river square shows the whole rule in the corridor note
    await page.locator('[data-cell="14,18"]').click();
    await expect(page.getByTestId('tile-rule')).toContainText('roll 1 combat die');
  });

  test('Rule hints can be turned off on the quest list: no reminder then', async ({ page }) => {
    await page.goto('/?nosave=1');
    const sw = page.getByTestId('rule-hints');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await gotoQuest(page, URL);
    await page.locator('[data-door="in"]').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.locator('[data-board-tile="icyRiver"]')).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByTestId('free-move')).toHaveCount(0);
    // back on, for the other tests of this browser profile
    await page.goto('/?nosave=1');
    await page.getByTestId('rule-hints').click();
  });

  test('with no monster awake the free-movement hint shows in a Frozen Horror quest', async ({
    page,
  }) => {
    await page.goto('/?quest=0&team=dwarf&nosave=1&seed=1');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('free-move')).toContainText('counting each red die as 4');
  });
});
