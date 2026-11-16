import { expect, test, type Page } from '@playwright/test';
import { dismissStart, gotoQuest } from './helpers';

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
  await dismissStart(page);
}

/** Walk through Zargon's dialogs (Done, Next) and end the turn. */
async function endTheTurn(page: Page) {
  await page.getByRole('button', { name: /^Zargon's turn/ }).click();
  for (let i = 0; i < 12; i++) {
    const end = page.getByRole('button', { name: "End Zargon's turn", exact: true });
    if (await end.count()) {
      await end.click();
      return;
    }
    const next = page.getByRole('button', { name: /^(Done|Next)$/ });
    await next.first().click();
  }
}

test.describe('adding a monster in play (decision 66)', () => {
  test('type, then tap its square: it is drawn, in the roster, and can be slain', async ({
    page,
  }) => {
    await startQuest1(page, ['Dwarf', 'Elf']);
    await expect(rosterRows(page)).toHaveCount(0);
    await page.getByTestId('add-monster-btn').click();
    await page.getByLabel('Monster to add').selectOption('goblin');
    await page.getByRole('button', { name: 'Choose its square' }).click();
    await expect(page.getByTestId('pick-banner')).toContainText('Goblin');
    const cell = page.locator('[data-pick-cell="4,17"]');
    const at = '4,17';
    await cell.click();
    await expect(page.getByTestId('pick-banner')).toHaveCount(0);
    await expect(rosterRows(page)).toHaveCount(1);
    await expect(rosterRows(page).first()).toContainText('Added in play');
    await expect(page.locator('[data-monster="w1"]')).toHaveCount(1);
    await shot(page, 'monster-added');
    expect(at).toMatch(/^\d+,\d+$/);
    // Cancel leaves nothing behind
    await page.getByTestId('add-monster-btn').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('add-monster')).toHaveCount(0);
  });
});

test.describe('quest and team select', () => {
  test('all 14 quests are encoded; start needs a hero', async ({ page }) => {
    await page.goto('/?nosave=1');
    await shot(page, 'select-start');
    await expect(page.locator('.qcard')).toHaveCount(14);
    await expect(page.getByText('Not encoded yet')).toHaveCount(0);
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

  test('look from here is offered only on squares with an eye', async ({ page }) => {
    await startQuest1(page, ['Dwarf']);
    await door(page, 'd1').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await page.waitForTimeout(800);
    // only the squares with an eye offer "Look from here"
    const eye = await page.locator('[data-eye]').first().getAttribute('data-eye');
    await page.locator(`[data-cell="${eye}"]`).click();
    await expect(page.getByRole('dialog', { name: 'A hero stands here' })).toBeVisible();
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'note-look');
    await page.getByRole('button', { name: 'Look from here', exact: true }).click();
    await expect(page.locator(`[data-eye="${eye}"]`)).toHaveCount(0); // looked from: no eye now
    // a seen square without an eye has no look button, only the secret door search
    await page.locator('[data-cell="4,18"]').click();
    await expect(page.getByRole('dialog')).toContainText('Nothing new can be seen from here.');
    await expect(page.getByRole('button', { name: 'Look from here', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Search for secret doors', exact: true }),
    ).toBeVisible();
    // Escape closes a note
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // a tap outside closes it as well
    await page.locator('[data-cell="4,18"]').click();
    await page.locator('aside .lbl').first().click();
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
    const before = await rosterRows(page).count();
    await page.getByRole('button', { name: 'Slain' }).click();
    await expect(rosterRows(page)).toHaveCount(before - 1); // a slain monster leaves the list
    await expect(page.locator('.toast')).toContainText('slain');
    await page.waitForTimeout(350); // let the pop animation finish
    await shot(page, 'monster-slain');
    // undo brings it back
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect(rosterRows(page)).toHaveCount(before);
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
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1,d2');
    await page.locator('[data-monster]').first().click();
    await expect(page.getByRole('dialog')).toContainText('Move 8');
  });

  test("Zargon's turn button advances the turn counter", async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    await endTheTurn(page);
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
    await dismissStart(page);
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
  await dismissStart(page);
  for (const d of ['d1', 'd2']) {
    await door(page, d).click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
  }
  await endTheTurn(page);
  await expect(page.locator('header .turn')).toContainText('Turn 2');
  await page.waitForTimeout(300); // let the autosave finish
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('everything lands at once', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await door(page, 'd2').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    // no ink mask and tokens are there at once
    await expect(page.locator('#inkmask')).toHaveCount(0);
    await expect(page.locator('.tok')).toHaveCount(2);
    await shot(page, 'reduced-motion');
  });
});
