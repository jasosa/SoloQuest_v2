import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/${name}.png` });
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);
const rosterRows = (page: Page) => page.locator('.roster li:not(.empty)');

async function startQuest1(page: Page, heroes: string[]) {
  await page.goto('/?nosave=1');
  await page
    .getByRole('button', { name: /Quest 1/ })
    .first()
    .click();
  for (const h of heroes) await page.getByRole('button', { name: h, exact: true }).click();
  await page.getByRole('button', { name: 'Start the quest' }).click();
}

test.describe('quest and team select', () => {
  test('quests that are not encoded are disabled; start needs a hero', async ({ page }) => {
    await page.goto('/?nosave=1');
    await shot(page, 'select-start');
    await expect(page.locator('.qcard')).toHaveCount(14);
    await expect(page.getByRole('button', { name: /Quest 2/ })).toBeDisabled();
    await expect(page.getByText('Not encoded yet')).toHaveCount(13);
    const start = page.getByRole('button', { name: 'Start the quest' });
    await expect(start).toBeDisabled();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await shot(page, 'select-team');
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await expect(page.locator('header .qn')).toHaveText('Quest 1');
  });
});

test.describe('play quest 1', () => {
  test('start room is shown, the rest is rock; no monsters yet', async ({ page }) => {
    await startQuest1(page, ['Dwarf', 'Elf']);
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('.roster .empty')).toBeVisible();
    await expect(page.locator('.tok')).toHaveCount(0);
    await expect(door(page, 'd1')).toHaveCount(1);
    await expect(door(page, 'd2')).toHaveCount(0);
    await shot(page, 'play-start');
  });

  test('open doors by tap: monsters appear, then undo takes them away', async ({ page }) => {
    await startQuest1(page, ['Dwarf']);
    await door(page, 'd1').click();
    await expect(page.getByRole('dialog', { name: 'Open this door?' })).toBeVisible();
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'note-door');
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await door(page, 'd2').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(rosterRows(page)).toHaveCount(2);
    await expect(page.locator('.tok')).toHaveCount(2);
    await page.waitForTimeout(250);
    await shot(page, 'reveal-midway');
    await page.waitForTimeout(900);
    await shot(page, 'reveal-done');
    await expect(page.locator('header .turn')).toContainText('Turn 1');

    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(rosterRows(page)).toHaveCount(0);
    await expect(page.locator('.tok')).toHaveCount(0);
    await expect(door(page, 'd2')).toHaveCount(1); // seen and closed again
  });

  test('look from here shows the margin note and a toast when nothing is new', async ({ page }) => {
    await startQuest1(page, ['Dwarf']);
    await door(page, 'd1').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await page.waitForTimeout(800);
    await page.locator('[data-cell="3,18"]').click();
    await expect(page.getByRole('dialog', { name: 'A hero stands here' })).toBeVisible();
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'note-look');
    await page.getByRole('button', { name: 'Look from here', exact: true }).click();
    await expect(page.locator('.toast')).toHaveText(/Nothing new here/);
    // Escape closes a note
    await page.locator('[data-cell="4,18"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // a tap outside closes it as well
    await page.locator('[data-cell="4,18"]').click();
    await page.locator('aside .goal').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('monster callout: wound and heal only above 1 Body, slain greys the roster', async ({
    page,
  }) => {
    await startQuest1(page, ['Dwarf']);
    for (const d of ['d1', 'd2', 'd3']) {
      await door(page, d).click();
      await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    }
    await page.waitForTimeout(1200);
    // the orc has 1 Body: no wound or heal buttons
    await page.locator('.roster li button', { hasText: 'Orc' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Move 8');
    await expect(page.getByRole('button', { name: /Wound/ })).toHaveCount(0);
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'note-monster');
    await page.keyboard.press('Escape');
    // the abomination has 2 Body
    await page.locator('.roster li button', { hasText: 'Abomination' }).click();
    await expect(page.getByRole('button', { name: /Wound/ })).toBeVisible();
    await page.getByRole('button', { name: /Wound/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Body 1 of 2');
    await expect(page.getByRole('button', { name: /Wound/ })).toBeDisabled();
    await page.getByRole('button', { name: /Heal/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Body 2 of 2');
    await page.getByRole('button', { name: 'Slain' }).click();
    await expect(page.locator('.roster li.dead')).toHaveCount(1);
    await expect(page.locator('.toast')).toContainText('slain');
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'monster-slain');
    // undo brings it back
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.roster li.dead')).toHaveCount(0);
  });

  test('a door can be opened with the keyboard', async ({ page }) => {
    await startQuest1(page, ['Dwarf']);
    await door(page, 'd1').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Open this door?' })).toBeVisible();
    await page.getByRole('button', { name: 'Open the door', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(door(page, 'd2')).toHaveCount(1);
  });

  test('tap on a token opens its callout', async ({ page }) => {
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1,d2');
    await page.locator('[data-monster]').first().click();
    await expect(page.getByRole('dialog')).toContainText('Move 8');
  });

  test("Zargon's turn button advances the turn counter", async ({ page }) => {
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1');
    await page.getByRole('button', { name: /Zargon's turn/ }).click();
    await page.getByRole('button', { name: "End Zargon's turn" }).click();
    await expect(page.locator('header .turn')).toContainText('Turn 2');
  });

  test('reload resumes the game', async ({ page }) => {
    await startQuestWithSave(page);
    await expect(rosterRows(page)).toHaveCount(2);
    await page.reload();
    await page
      .getByRole('button', { name: /Quest 1/ })
      .first()
      .click();
    await expect(page.getByText('Saved game')).toBeVisible();
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'select-resume');
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(rosterRows(page)).toHaveCount(2);
    await expect(page.locator('header .turn')).toContainText('Turn 2');
    await expect(door(page, 'd2')).toHaveCount(0); // d2 stays open (only closed doors can be tapped)
    await expect(door(page, 'd3')).toHaveCount(1);
  });
});

test.describe('new game over a saved game', () => {
  test('asks first; keeping the save leaves it intact, replacing starts fresh', async ({
    page,
  }) => {
    await startQuestWithSave(page);
    await page.reload();
    await page
      .getByRole('button', { name: /Quest 1/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByRole('button', { name: /New game/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Replace the saved game');
    await page.getByRole('button', { name: 'Keep the saved game' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByText('Saved game')).toBeVisible();
    await page.getByRole('button', { name: /New game/ }).click();
    await page.getByRole('button', { name: 'Replace it' }).click();
    await expect(page.locator('header .turn')).toContainText('Turn 1');
    await expect(rosterRows(page)).toHaveCount(0);
  });
});

async function startQuestWithSave(page: Page) {
  await page.goto('/');
  await page
    .getByRole('button', { name: /Quest 1/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
  await page.getByRole('button', { name: 'Start the quest' }).click();
  for (const d of ['d1', 'd2']) {
    await door(page, d).click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
  }
  await page.getByRole('button', { name: /Zargon's turn/ }).click();
  await page.getByRole('button', { name: "End Zargon's turn" }).click();
  await expect(page.locator('header .turn')).toContainText('Turn 2');
  await page.waitForTimeout(300); // let the autosave finish
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('everything lands at once', async ({ page }) => {
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await door(page, 'd2').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    // no ink mask and tokens are there at once
    await expect(page.locator('#inkmask')).toHaveCount(0);
    await expect(page.locator('.tok')).toHaveCount(2);
    await shot(page, 'reduced-motion');
  });
});
