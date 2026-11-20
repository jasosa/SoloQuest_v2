import { expect, test, type Page } from '@playwright/test';
import { gotoQuest, openEndSheet } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dlg = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) => page.locator('.roster li:not(.empty)');
const finishChip = (page: Page) => page.getByTestId('finish-quest');

/** Quest 1 up to the moment Verag is slain: the last objective is done. */
async function slayVerag(page: Page) {
  await gotoQuest(
    page,
    '/?quest=1&team=dwarf,elf&nosave=1&seed=1&open=d1,look@13:18,look@13:12,look@16:12,d6',
  );
  await page.waitForTimeout(900);
  await rows(page).filter({ hasText: 'Verag' }).click();
  await btn(page, 'Slain').click();
  await btn(page, 'Yes, it is slain').click();
}

test.describe('the end flow (decision 97)', () => {
  test('the goal line opens one sheet: checklist, ways to end; no End quest chip', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await expect(btn(page, 'End quest')).toHaveCount(0);
    await expect(finishChip(page)).toHaveCount(0); // the goal is not done
    const goal = page.getByTestId('goal-line');
    await expect(goal).toContainText('Verag');
    expect((await goal.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await openEndSheet(page);
    const sheet = dlg(page);
    await page.waitForTimeout(450); // the sheet rises: measure it at rest
    await expect(sheet.locator('.goals li')).toHaveCount(1);
    await expect(sheet.locator('.goals li.done')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Finish the quest' })).toHaveCount(0);
    for (const name of ['Leave without finishing', 'All heroes fell', 'Keep playing']) {
      const b = sheet.getByRole('button', { name, exact: true });
      await expect(b).toBeVisible();
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await shot(page, 'endflow-sheet');
    await btn(page, 'Keep playing').click();
    await expect(sheet).toHaveCount(0);
  });

  test('keyboard: focus goes in, Tab stays inside, Escape closes and focus comes back', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await page.getByTestId('goal-line').focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'Goal and ending' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Leave without finishing' })).toBeFocused();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('goal-line')).toBeFocused();
  });

  test('leave without finishing: one confirmation, the end card says goal not reached, undo', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await openEndSheet(page);
    await btn(page, 'Leave without finishing').click();
    await expect(dlg(page)).toContainText('Leave without finishing?');
    await expect(dlg(page)).toContainText('not done');
    await btn(page, 'Back').click(); // back to the sheet, nothing ended
    await expect(dlg(page)).toContainText('Goal and ending');
    await btn(page, 'Leave without finishing').click();
    await page.getByTestId('end-confirm').click();
    await expect(dlg(page)).toContainText('Quest over, goal not reached');
    await btn(page, 'Undo the ending').click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.getByTestId('goal-line')).toBeVisible();
  });

  test('all heroes fell: the sheet, one confirmation, the end card; undo', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await openEndSheet(page);
    await btn(page, 'All heroes fell').click();
    await expect(dlg(page)).toContainText('All heroes fell?');
    await shot(page, 'endflow-confirm');
    await page.getByTestId('end-confirm').click();
    await expect(dlg(page)).toContainText('Quest over, goal not reached');
    await btn(page, 'Undo the ending').click();
    await expect(dlg(page)).toHaveCount(0);
  });

  test('the last objective: the message ends with "Finish the quest", it can be dismissed, the band keeps the button', async ({
    page,
  }) => {
    await slayVerag(page);
    const msg = page.getByRole('dialog', { name: 'Find and destroy Verag' });
    await expect(msg).toContainText('All objectives are done');
    await expect(msg.getByRole('button', { name: 'Finish the quest' })).toBeVisible();
    await shot(page, 'endflow-message');
    await msg.getByRole('button', { name: 'Continue' }).click();
    await expect(dlg(page)).toHaveCount(0); // nothing is forced
    await expect(finishChip(page)).toBeVisible();
    await expect(page.getByTestId('goal-line')).toContainText('Goal done');
    expect((await finishChip(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'endflow-band-done');
    // the sheet now shows the checklist done and "Finish the quest" first
    await openEndSheet(page);
    await expect(dlg(page).locator('.goals li.done')).toHaveCount(1);
    await expect(dlg(page).getByTestId('end-finish')).toBeVisible();
    await expect(dlg(page).getByRole('button', { name: 'Leave without finishing' })).toHaveCount(0);
    await shot(page, 'endflow-sheet-done');
  });

  test('Finish the quest from the message: one confirmation, the end card, undo', async ({
    page,
  }) => {
    await slayVerag(page);
    await page.getByTestId('sheet-finish').click();
    await expect(dlg(page)).toContainText('Finish the quest?');
    await btn(page, 'Back').click();
    await expect(dlg(page)).toHaveCount(0); // back to the map, nothing ended
    await finishChip(page).click();
    await page.getByTestId('end-confirm').click();
    const end = page.getByRole('dialog', { name: 'Quest complete' });
    await expect(end).toContainText('The goal was done');
    await btn(page, 'Undo the ending').click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(finishChip(page)).toBeVisible(); // the goal is still done
  });

  test('a confirm button sits under its objective; pressing it closes the sheet and the message offers Finish', async ({
    page,
  }) => {
    // quest 4: the confirm is always there (the goal is chests brought to the stairs)
    await gotoQuest(page, '/?quest=4&team=dwarf&nosave=1&seed=1');
    await expect(page.getByTestId('goal-line')).toHaveClass(/dot/);
    await openEndSheet(page);
    const confirm = btn(page, 'All three chests are on the stairs');
    await expect(confirm).toBeVisible();
    await shot(page, 'endflow-confirm-inline');
    await confirm.click();
    const msg = dlg(page);
    await expect(msg).toContainText('All objectives are done');
    await expect(msg.getByRole('button', { name: 'Finish the quest' })).toBeVisible();
    await msg.getByRole('button', { name: 'Continue' }).click();
    await expect(finishChip(page)).toBeVisible();
    // undo the confirm: the button comes back
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(finishChip(page)).toHaveCount(0);
  });

  test('a quest ending asks once, then ends with its own card; Back keeps playing', async ({
    page,
  }) => {
    await gotoQuest(page, '/?quest=2&team=dwarf,elf&nosave=1&seed=1');
    await openEndSheet(page);
    await btn(page, 'Sir Ragnar died').click();
    await expect(dlg(page)).toContainText('Sir Ragnar died?');
    await btn(page, 'Back').click();
    await expect(dlg(page)).toContainText('Goal and ending');
    await btn(page, 'Sir Ragnar died').click();
    await page.getByTestId('end-confirm').click();
    await expect(dlg(page)).toContainText('Quest over');
    await expect(dlg(page)).toContainText('the rescue has failed');
    await btn(page, 'Undo the ending').click();
    await expect(dlg(page)).toHaveCount(0);
  });

  test('several objectives show the progress on the goal line', async ({ page }) => {
    await page.goto('/?quest=fh03-the-rescue&team=dwarf&nosave=1&seed=1');
    await btn(page, 'Continue').click(); // the start note
    const goal = page.getByTestId('goal-line');
    await expect(goal).toContainText('0 of 2 done');
    await openEndSheet(page);
    await expect(dlg(page).locator('.goals li')).toHaveCount(2);
    await expect(btn(page, 'Gothar was captured')).toBeVisible();
    // the second objective can be confirmed only after Gothar is free
    await expect(btn(page, 'The Barbarian and Gothar are on the stairway')).toHaveCount(0);
  });

  test('all heroes fallen: the card leads into the same sheet', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ }).click();
    await btn(page, 'Yes, fell').click();
    await dlg(page).getByRole('button', { name: 'End quest' }).click();
    await expect(dlg(page)).toContainText('Goal and ending');
    await btn(page, 'All heroes fell').click();
    await expect(dlg(page)).toContainText('All heroes fell?');
  });

  test('a quest with no objectives: the goal line opens the sheet, the stairs button asks once', async ({
    page,
  }) => {
    // the engine test fixture has no objectives (the editor requires one, so this is the only way)
    await page.goto('/?quest=test&team=dwarf&nosave=1&seed=1');
    await page.locator('#board').waitFor();
    const goal = page.getByTestId('goal-line');
    await expect(goal).toContainText('End the quest');
    await goal.click();
    const sheet = page.getByRole('dialog', { name: 'Goal and ending' });
    await expect(sheet.locator('.goals')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Finish the quest' })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Heroes left by the stairs', exact: true }).click();
    await page.getByTestId('end-confirm').click();
    await expect(page.getByRole('dialog', { name: /^Quest/ })).toBeVisible();
  });
});
