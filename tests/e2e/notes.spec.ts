import { expect, test, type Page } from '@playwright/test';
import {
  closeQuestSheet,
  dismissStart,
  gotoQuest,
  newGame,
  openQuest,
  openQuestSheet,
} from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(400); // let the animations finish
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dialog = (page: Page) => page.getByRole('dialog');
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);
const roomCell = (page: Page, key: string) => page.locator(`[data-room-cell="${key}"]`);
const rows = (page: Page) => page.locator('.roster li:not(.empty)');
/** Rows of the journal, without the "Start" line every quest begins with. */
const journalRows = (page: Page) =>
  page.locator('.qsheet .journal li').filter({ hasNotText: /^\W*Start\W*$/ });

// Quest 1: corridor squares to look from, in order, to see the doors of the north-west rooms.
const ROW9 = 'look@1:18,look@0:17,look@0:9';
const quest1 = (page: Page, open: string, team = 'dwarf,elf') =>
  gotoQuest(page, `/?quest=1&team=${team}&nosave=1&seed=1&open=${open}`);
const fixture = (page: Page, open = '') =>
  page.goto(`/?quest=test&team=dwarf,elf&nosave=1&seed=1&open=${open}`);

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

test.describe('quest 1 notes', () => {
  test('note C shows when R02 opens, leaves a letter on the map and a line in the journal', async ({
    page,
  }) => {
    await quest1(page, `d1,${ROW9},d8,d10`);
    await expect(page.locator('[data-letter]')).toHaveCount(0);
    await openQuestSheet(page);
    await expect(journalRows(page)).toHaveCount(0);
    await closeQuestSheet(page);
    await door(page, 'd11').click();
    await btn(page, 'Open the door').click();
    const card = page.getByRole('dialog', { name: 'Note C' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('4 attack dice');
    await shot(page, 'notes-card-c');
    await btn(page, 'Continue').click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(page.locator('[data-letter="n-C"]')).toHaveCount(1);
    await openQuestSheet(page);
    await expect(journalRows(page)).toHaveCount(1);
    await expect(journalRows(page).first()).toContainText('C');
    await shot(page, 'notes-quest-sheet');
    await closeQuestSheet(page);
    await shot(page, 'notes-letter-map');

    // tap the letter on the map, or the journal line, to read it again
    await page.locator('[data-letter="n-C"]').click();
    await expect(page.getByRole('dialog', { name: 'Read again' })).toContainText('guardian');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await openQuestSheet(page);
    await journalRows(page).first().getByRole('button').click();
    await expect(dialog(page)).toContainText('4 attack dice');
    await btn(page, 'Close').click();
    await expect(page.getByRole('dialog', { name: 'Quest sheet' })).toBeVisible(); // back to the sheet
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
    await openQuestSheet(page);
    await expect(journalRows(page)).toHaveCount(1);
    await closeQuestSheet(page);
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
    await btn(page, 'Yes, it is slain').click();
    // a sheet tells that the objective is done
    await expect(page.getByRole('dialog', { name: 'Find and destroy Verag' })).toContainText(
      'All objectives are done',
    );
    await btn(page, 'Continue').click();
    await expect(page.locator('header .goalline')).toContainText('Bring the heroes back');
    await openQuestSheet(page);
    await expect(page.locator('.qsheet .goals li.done')).toHaveCount(1);
    await expect(
      page.getByText('Goal done. Bring the heroes back to the stairs.').first(),
    ).toBeVisible();
    await shot(page, 'notes-goal-done');
    await closeQuestSheet(page);

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
    await expect(page.locator('header h1')).toHaveText('Home');
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
    await openQuest(page, 1);
    await newGame(page, ['Dwarf']);
    await dismissStart(page);
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
    await openQuest(page, 1);
    await btn(page, 'Resume').click();
    await expect(page.locator('[data-letter="n-A"]')).toHaveCount(1);
    await expect(dialog(page)).toHaveCount(0); // nothing is replayed as a sheet
    await openQuestSheet(page);
    await expect(journalRows(page)).toHaveCount(1);
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
    await openQuestSheet(page);
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
    // the marker stays while the square has a button of its own (decision 67)
    await expect(marker).toHaveCount(1);
    await marker.click();
    await expect(btn(page, 'Yes')).toHaveCount(0); // no "Did a hero step here?" any more
    await expect(page.locator('.fq')).toContainText('A cold draft');
    await page.locator('.fq').getByRole('button', { name: 'Seal the crack' }).click();
    await expect(dialog(page)).toContainText('The crack is sealed.');
    await btn(page, 'Continue').click();
    await expect(marker).toHaveCount(0); // nothing left to do here
  });

  test('a ring on a look-from-here square hides the eye and offers "Look from here" in its note', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    await expect(page.locator('[data-square="1,18"]')).toHaveCount(1);
    await expect(page.locator('[data-eye="1,18"]')).toHaveCount(0); // no ring on top of an eye
    await page.locator('[data-square="1,18"]').click();
    await expect(page.locator('.fq')).toContainText('A scratch on the floor.');
    await expect(btn(page, 'Yes')).toHaveCount(0); // a button-only square asks nothing
    await expect(btn(page, 'Mark the spot')).toHaveCount(0); // not before the look
    await expect(btn(page, 'Look from here')).toBeVisible();
    await shot(page, 'notes-ring-look');
    await btn(page, 'Look from here').click();
    await page.locator('[data-square="1,18"]').click(); // the ring stays for its button
    await expect(page.locator('.fq').getByRole('button', { name: 'Mark the spot' })).toBeVisible();
    await expect(btn(page, 'Look from here')).toHaveCount(0); // nothing left to see from here
  });

  test('a special monster has a ring, a star and its abilities; an ability alone does not', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    await expect(page.locator('[data-special]')).toHaveCount(0); // not seen yet
    await door(page, 'd3').click();
    await btn(page, 'Open the door').click();
    await btn(page, 'Pull the lever').click(); // the door's choice
    await btn(page, 'Continue').click();
    await page.waitForTimeout(900);
    await expect(page.locator('[data-special]')).toHaveCount(1);
    await expect(page.locator('[data-special-row]')).toHaveCount(1);
    const goblin = page.locator('.roster li', { hasText: 'Goblin' });
    await expect(goblin).toContainText('Fireproof');
    await expect(goblin).toHaveAttribute('title', /Special monster/);
    await expect(goblin).toHaveAttribute('title', /Fire spells have no effect on it\./);
    // the orc has no ability and is not special
    const orc = page.locator('.roster li', { hasText: 'Orc' }).first();
    await expect(orc).not.toContainText('Fireproof');
    await expect(orc).not.toHaveAttribute('title', /Special monster/);
    await goblin.getByRole('button').click();
    await expect(page.getByTestId('abilities')).toContainText('Fireproof.');
    await expect(page.getByRole('dialog')).toContainText('Special monster');
    await shot(page, 'monster-special');
  });

  test('an enemy of the quest gives its monster a letter and a picture; others keep the letter icon', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    await door(page, 'd3').click();
    await btn(page, 'Open the door').click();
    await btn(page, 'Pull the lever').click();
    await btn(page, 'Continue').click();
    await page.waitForTimeout(900);
    // the Marsh Goblin: a picture on the token and in the roster, and the letter M in its code
    await expect(page.locator('[data-token-image]')).toHaveCount(1);
    const goblin = page.locator('.roster li', { hasText: 'Marsh Goblin' });
    await expect(goblin).toContainText('M1');
    await expect(goblin.locator('[data-coin-image]')).toHaveCount(1);
    // the orc has no picture: its coin and token show the letter icon
    const orc = page.locator('.roster li', { hasText: 'Orc' }).first();
    await expect(orc.locator('[data-coin-image]')).toHaveCount(0);
    await expect(orc).toContainText('O1');
    await shot(page, 'monster-image');
  });

  test('a zone (a set of squares) gets one label; a tap says "A hero enters" once', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    const label = page.locator('[data-zone="z1"]');
    await expect(label.first()).toBeVisible(); // one hit area per square of the zone
    await expect(page.locator('[data-zone-label="z1"]')).toHaveCount(1);
    await expect(page.locator('[data-zone-label="z1"] circle')).not.toHaveCount(0);
    await label.first().click();
    await expect(page.getByRole('dialog', { name: 'A hero enters' })).toContainText(
      'enters this square',
    );
    await shot(page, 'notes-zone');
    await btn(page, 'A hero enters').click();
    await expect(page.getByRole('dialog', { name: 'The cold spot' })).toContainText('cold here');
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-zone="z1"]')).toHaveCount(0); // no keepMark: it goes
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
    // the label stays while the room still has a button of its own to press
    await expect(page.locator('[data-enter="R17"]')).toHaveCount(1);
    await roomCell(page, '5,17').click();
    await expect(btn(page, 'A hero enters')).toHaveCount(0); // that one is used
    await btn(page, 'Knock on the wall').click();
    await btn(page, 'Continue').click();
    await expect(page.locator('[data-enter="R17"]')).toHaveCount(0);
    // the room that has no such note does not offer it
    await roomCell(page, '2,15').click();
    await expect(btn(page, 'A hero enters')).toHaveCount(0);
  });

  test('"For this quest": a room button, and the note read stays there to read again', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await roomCell(page, '5,17').click();
    const fq = page.locator('.fq');
    await expect(fq).toContainText('For this quest');
    await expect(fq.getByRole('button', { name: 'Knock on the wall' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Quest sheet' })).toHaveCount(0);
    await shot(page, 'notes-for-this-quest');
    await fq.getByRole('button', { name: 'Knock on the wall' }).click();
    await expect(dialog(page)).toContainText('Something knocks back.');
    await btn(page, 'Continue').click();
    // the button is gone; the note read is listed in the room's block
    await roomCell(page, '5,17').click();
    await expect(
      page.locator('.fq').getByRole('button', { name: 'Knock on the wall' }),
    ).toHaveCount(0);
    await expect(page.locator('.fq .nr')).toContainText('Something knocks back.');
    await page.locator('.fq .nr').click();
    await expect(dialog(page)).toContainText('Something knocks back.');
    // a button of an element is not listed in the Quest sheet
    await btn(page, 'Close').click();
    await openQuestSheet(page);
    await expect(page.getByRole('dialog', { name: 'Quest sheet' })).not.toContainText(
      'Knock on the wall',
    );
  });

  test('quest actions: a manual note brings an NPC chip; a placed monster is pointed out', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    await expect(page.getByTestId('quest-chip')).toHaveClass(/dot/); // something to press
    await openQuestSheet(page);
    await expect(page.getByText('Quest actions')).toBeVisible();
    await expect(page.locator('.npcs')).toHaveCount(0);
    await btn(page, 'Call for help').click();
    await expect(page.getByRole('dialog')).toContainText('A knight steps out');
    await btn(page, 'Continue').click();
    await expect(page.locator('.npcs')).toContainText('Sir Test');
    await expect(page.locator('.npcs')).toContainText('Defend dice 2');
    await expect(page.locator('.npcs')).toContainText('Body 3'); // the players write it down
    await expect(btn(page, 'Call for help')).toHaveCount(0); // each button works once
    await shot(page, 'notes-npc');

    await openQuestSheet(page);
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
    await endTheTurn(page);
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

test.describe('quest 2 endings and blocked search', () => {
  const quest2 = (page: Page, open = '') =>
    gotoQuest(page, `/?quest=2&team=dwarf,elf&nosave=1&seed=1&open=${open}`);

  test('end the quest by "Sir Ragnar died": the ending shows, no rewards, undo', async ({
    page,
  }) => {
    await quest2(page);
    await page.getByRole('button', { name: 'End quest', exact: true }).click();
    await expect(btn(page, 'Heroes left by the stairs')).toBeVisible();
    await expect(btn(page, 'Sir Ragnar died')).toBeVisible();
    expect((await btn(page, 'Sir Ragnar died').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, 'end-options-ending');
    await btn(page, 'Sir Ragnar died').click();
    const card = dialog(page);
    await expect(card).toContainText('Quest over');
    await expect(card).toContainText('Sir Ragnar died');
    await expect(card).toContainText('the rescue has failed');
    await expect(card).not.toContainText('left by the stairs');
    await expect(card).not.toContainText('Rewards');
    await shot(page, 'end-ending');
    await btn(page, 'Undo the ending').click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('searching the cell shows the note, says the search was not used, the hero can search again', async ({
    page,
  }) => {
    await quest2(page, 'd1,look@13:12,look@13:18,d8,d9');
    await page.waitForTimeout(900);
    await roomCell(page, '5,13').click();
    await btn(page, 'Search for secret doors').click();
    await btn(page, 'The room is clear, search anyway').click();
    await expect(dialog(page)).toContainText('secret door');
    await btn(page, 'Done').click();
    await door(page, 's1').click();
    await btn(page, 'Open the door').click();
    await page.waitForTimeout(700);
    await door(page, 'd10').click();
    await btn(page, 'Open the door').click();
    // the alarm note, then maybe more sheets
    for (let i = 0; i < 4 && (await btn(page, 'Continue').count()); i++)
      await btn(page, 'Continue').click();
    await roomCell(page, '5,11').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'Dwarf').click();
    const card = dialog(page);
    await expect(card).toContainText('cannot search for treasure in the cell');
    await expect(card).toContainText('The search was not used');
    await shot(page, 'search-blocked');
    await btn(page, 'Continue').click();
    // the Dwarf is not marked as searched: still enabled
    await roomCell(page, '5,11').click();
    await btn(page, 'Search for treasure').click();
    await expect(btn(page, 'Dwarf')).toBeEnabled();
  });
});
