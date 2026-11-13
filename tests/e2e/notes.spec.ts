import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(400); // let the animations finish
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dialog = (page: Page) => page.getByRole('dialog');
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);
const roomCell = (page: Page, key: string) => page.locator(`[data-room-cell="${key}"]`);
const rows = (page: Page) => page.locator('.roster li:not(.empty)');
const journalRows = (page: Page) => page.locator('.journal li');

// Quest 1: corridor squares to look from, in order, to see the doors of the north-west rooms.
const ROW9 = 'look@2:18,look@4:18,look@1:18,look@5:18,look@0:17,look@0:9';
const quest1 = (page: Page, open: string, team = 'dwarf,elf') =>
  page.goto(`/?quest=1&team=${team}&nosave=1&seed=1&open=${open}`);
const fixture = (page: Page, open = '') =>
  page.goto(`/?quest=test&team=dwarf,elf&nosave=1&seed=1&open=${open}`);

test.describe('quest 1 notes', () => {
  test('note C shows when R02 opens, leaves a letter on the map and a line in the journal', async ({
    page,
  }) => {
    await quest1(page, `d1,${ROW9},d8,d10`);
    await expect(page.locator('[data-letter]')).toHaveCount(0);
    await expect(page.getByText('No quest note read yet.')).toBeVisible();
    await door(page, 'd11').click();
    await btn(page, 'Open the door').click();
    const card = page.getByRole('dialog', { name: 'Note C' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('4 attack dice');
    await shot(page, 'notes-card-c');
    await btn(page, 'Continue').click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(page.locator('[data-letter="n-C"]')).toHaveCount(1);
    await expect(journalRows(page)).toHaveCount(1);
    await expect(journalRows(page).first()).toContainText('C');
    await shot(page, 'notes-letter-map');

    // tap the letter on the map, or the journal line, to read it again
    await page.locator('[data-letter="n-C"]').click();
    await expect(page.getByRole('dialog', { name: 'Read again' })).toContainText('guardian');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await journalRows(page).first().getByRole('button').click();
    await expect(dialog(page)).toContainText('4 attack dice');
    await btn(page, 'Close').click();
  });

  test('search notes A and E give letters; an unread note leaves no trace', async ({ page }) => {
    await quest1(page, 'd1,d2,d3');
    await page.waitForTimeout(900);
    await expect(page.locator('[data-letter]')).toHaveCount(0);
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Dwarf').click();
    await expect(page.getByRole('dialog', { name: 'Note A' })).toContainText('rusty');
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-letter="n-A"]')).toHaveCount(1);
    await expect(page.locator('[data-letter="n-E"]')).toHaveCount(0);
    await expect(journalRows(page)).toHaveCount(1);
    // the next search gives no note, only a card to draw
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Elf').click();
    await expect(dialog(page)).toContainText('Draw a treasure card');
    await btn(page, 'Done').click();
  });

  test('note E, then the goal ticks when Verag is slain, then the quest ends', async ({ page }) => {
    await quest1(page, 'd1,look@13:18,look@13:12,look@16:12,d6');
    await page.waitForTimeout(900);
    await expect(page.locator('.goals li.done')).toHaveCount(0);
    // search the chest room (monsters are here: override)
    await roomCell(page, '11,8').or(roomCell(page, '12,9')).first().click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Elf').click();
    await expect(page.getByRole('dialog', { name: 'Note E' })).toContainText('120 gold coins');
    await shot(page, 'notes-card-gold');
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-letter="n-E"]')).toHaveCount(1);

    // slay Verag
    await rows(page).filter({ hasText: 'Verag' }).click();
    await btn(page, 'Slain').click();
    await expect(page.locator('.goals li.done')).toHaveCount(1);
    await expect(
      page.getByText('Goal done. Bring the heroes back to the stairs.').first(),
    ).toBeVisible();
    await shot(page, 'notes-goal-done');

    // end the quest
    await btn(page, 'End quest').click();
    await expect(dialog(page)).toContainText('How did the quest end?');
    await shot(page, 'notes-end-ask');
    await btn(page, 'Heroes left by the stairs').click();
    const end = page.getByRole('dialog', { name: 'Quest complete' });
    await expect(end).toBeVisible();
    await expect(end).toContainText('The goal was done');
    await shot(page, 'notes-end-screen');
    // undo the ending: the game is playable again
    await btn(page, 'Undo the ending').click();
    await expect(dialog(page)).toHaveCount(0);
    await btn(page, 'End quest').click();
    await btn(page, 'All heroes fell').click();
    await expect(
      page
        .getByRole('dialog', { name: 'Quest over, goal not reached' })
        .or(page.getByRole('dialog', { name: 'Quest complete' })),
    ).toBeVisible();
    await btn(page, 'Back to the quests').click();
    await expect(page.locator('header h1')).toHaveText('Choose a quest');
  });

  test('a quest that is not won says so', async ({ page }) => {
    await quest1(page, 'd1');
    await btn(page, 'End quest').click();
    await btn(page, 'All heroes fell').click();
    const end = page.getByRole('dialog', { name: 'Quest over, goal not reached' });
    await expect(end).toContainText('The goal was not done');
    await shot(page, 'notes-end-lost');
  });

  test('reload keeps the letters and journal and does not replay the notes', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /Quest 1/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await page.getByRole('button', { name: 'Start the quest' }).click();
    for (const d of ['d1', 'd2', 'd3']) {
      await door(page, d).click();
      await btn(page, 'Open the door').click();
    }
    await page.waitForTimeout(900);
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Dwarf').click();
    await expect(page.getByRole('dialog', { name: 'Note A' })).toBeVisible();
    await btn(page, 'Continue').click();
    await page.waitForTimeout(300);

    await page.reload();
    await page
      .getByRole('button', { name: /Quest 1/ })
      .first()
      .click();
    await btn(page, 'Resume').click();
    await expect(page.locator('[data-letter="n-A"]')).toHaveCount(1);
    await expect(journalRows(page)).toHaveCount(1);
    await expect(dialog(page)).toHaveCount(0); // nothing is replayed as a sheet
  });
});

test.describe('notes engine on the dev fixture', () => {
  test('a door wakes the statue, which stamps into the roster, and a choice must be answered', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    // the dormant statue is a figure on the map, not in the roster, not a monster
    await expect(page.locator('[data-statue="m-statue"]')).toHaveCount(1);
    await expect(rows(page)).toHaveCount(1); // only the orc of R17, not the statue
    await shot(page, 'notes-statue');
    await door(page, 'd3').click();
    await btn(page, 'Open the door').click();

    // the statue woke up: a toast, a roster row and a token
    await expect(page.locator('[data-statue]')).toHaveCount(0);
    await expect(rows(page).filter({ hasText: 'The statue' })).toHaveCount(1);
    await expect(page.locator('.toast')).toContainText('The statue is awake');
    // the choice cannot be skipped
    const choice = page.getByRole('dialog', { name: 'Choose' });
    await expect(choice).toContainText('A lever hangs by the door');
    await page.keyboard.press('Escape');
    await expect(choice).toBeVisible();
    await shot(page, 'notes-choice');
    await btn(page, 'Pull the lever').click();
    await expect(dialog(page)).toContainText('A far gate grinds open.');
    await btn(page, 'Continue').click();
    await expect(dialog(page)).toHaveCount(0);
    // the chosen text is in the journal
    await expect(journalRows(page)).toHaveCount(1);
    await journalRows(page).first().getByRole('button').click();
    await expect(dialog(page)).toContainText('You chose: Pull the lever');
    await expect(dialog(page)).toContainText('A far gate grinds open.');
  });

  test('a square marker asks "Did a hero step here?"; Yes shows the note with its letter', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    const marker = page.locator('[data-square="4,18"]');
    await expect(marker).toHaveCount(1);
    await marker.click();
    await expect(dialog(page)).toContainText('Did a hero step here?');
    await shot(page, 'notes-square');
    await btn(page, 'No').click();
    await expect(dialog(page)).toHaveCount(0);
    await marker.click();
    await btn(page, 'Yes').click();
    await expect(page.getByRole('dialog', { name: 'A cold draft' })).toContainText('cold draft');
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-letter="n-sq"]')).toHaveCount(1);
    await expect(marker).toHaveCount(0); // the note fired once
  });

  test('a room with an areaEntered note offers "A hero enters"', async ({ page }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await expect(page.locator('[data-enter="R17"]')).toHaveCount(1);
    await roomCell(page, '5,17').click();
    await shot(page, 'notes-enter-room');
    await btn(page, 'A hero enters').click();
    await expect(page.getByRole('dialog', { name: 'The study' })).toContainText('Dust');
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-enter="R17"]')).toHaveCount(0);
    // the room that has no such note does not offer it
    await roomCell(page, '2,15').click();
    await expect(btn(page, 'A hero enters')).toHaveCount(0);
  });

  test('quest actions: a manual note brings an NPC chip; a placed monster is pointed out', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    await expect(page.getByText('Quest actions')).toBeVisible();
    await expect(page.locator('.npcs')).toHaveCount(0);
    await btn(page, 'Call for help').click();
    await expect(page.getByRole('dialog')).toContainText('A knight steps out');
    await btn(page, 'Continue').click();
    await expect(page.locator('.npcs')).toContainText('Sir Test');
    await expect(page.locator('.npcs')).toContainText('Defend 2');
    await expect(page.locator('.npcs')).not.toContainText('Body');
    await expect(btn(page, 'Call for help')).toHaveCount(0); // each button works once
    await shot(page, 'notes-npc');

    await btn(page, 'Wake the guardian').click();
    await expect(dialog(page)).toContainText('Put');
    await expect(dialog(page)).toContainText('on the marked square');
    await shot(page, 'notes-place');
    await btn(page, 'Done').click();
    await expect(rows(page).filter({ hasText: 'Placed by a quest note' })).toHaveCount(1);
    await expect(page.locator('[data-monster]')).toHaveCount(1); // the guardian token (the statue is only a figure)
  });

  test("Zargon's turn still just ends the turn", async ({ page }) => {
    await fixture(page);
    await page.getByRole('button', { name: /Zargon's turn/ }).click();
    await expect(page.locator('header .turn')).toContainText('Turn 2');
  });
});

test.describe('false doors', () => {
  test('a false door cannot be opened and the players are told so', async ({ page }) => {
    await page.goto('/?quest=test&team=dwarf&nosave=1&seed=1');
    await door(page, 'x1').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.getByText('This door cannot be opened.')).toBeVisible();
    await expect(door(page, 'x1')).toHaveCount(1); // still closed and tappable
  });
});
