import { expect, test, type Page } from '@playwright/test';
import { closeQuestSheet, gotoQuest, openQuestSheet } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Quest sheet' });

test.describe('Quest sheet (decision 67)', () => {
  test('the title band shows the goal, the side column has no goal or journal', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await expect(page.locator('header .goalline')).toContainText('Verag');
    await expect(page.locator('aside .goal')).toHaveCount(0);
    await expect(page.locator('aside .journal')).toHaveCount(0);
    await expect(page.getByText('Quest actions')).toHaveCount(0);
    await shot(page, 'questsheet-band');
  });

  test('opens from the chip with the start text, goal and log; Esc and Close shut it', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await openQuestSheet(page);
    await expect(sheet(page)).toContainText('Place the heroes on the stairs.');
    // the quest intro of the quest list can be read again inside the quest
    await expect(sheet(page).getByTestId('quest-intro')).toContainText('Verag');
    await expect(sheet(page)).toContainText('Verag');
    await expect(sheet(page)).toContainText('A door was opened');
    await expect(sheet(page)).toContainText('The quest starts');
    await expect(page.getByTestId('quest-chip')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'questsheet-open');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
    await openQuestSheet(page);
    await sheet(page).getByRole('button', { name: 'Close quest sheet' }).click();
    await expect(sheet(page)).toHaveCount(0);
  });

  test('the log follows the game, and undo takes a line back', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await openQuestSheet(page);
    await expect(sheet(page).locator('.log li')).toHaveCount(3); // start, start note, door
    await closeQuestSheet(page);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await openQuestSheet(page);
    await expect(sheet(page).locator('.log li')).toHaveCount(2);
    await expect(sheet(page)).not.toContainText('A door was opened');
  });
});
