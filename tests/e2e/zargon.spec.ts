import { expect, test, type Page } from '@playwright/test';
import { gotoQuest, openQuestSheet } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450); // let the card settle
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const zbutton = (page: Page) => page.locator('.zargon-btn');
const dlg = (page: Page) => page.getByRole('dialog');

const quest1 = (page: Page, open: string, team = 'dwarf,elf,wizard', seed = 5) =>
  gotoQuest(page, `/?quest=1&team=${team}&nosave=1&seed=${seed}&open=${open}`);
const fixture = (page: Page, open = '', team = 'dwarf,elf,wizard') =>
  page.goto(`/?quest=test&team=${team}&nosave=1&seed=3&open=${open}`);

test.describe("Zargon's turn, one monster at a time", () => {
  test('the first dialog shows the order, the figure is highlighted', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await expect(zbutton(page)).toContainText('2 monsters to act');
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('Monster 1 of 2');
    await expect(dlg(page)).toContainText('Orc');
    await expect(dlg(page)).toContainText('Move 8 · Att 3 · Def 2');
    await expect(dlg(page).getByText('Target', { exact: true })).toBeVisible();
    await expect(dlg(page).getByText('Tie', { exact: true })).toBeVisible();
    await expect(dlg(page).getByText('Plan', { exact: true })).toBeVisible();
    await expect(dlg(page).locator('.tgt')).toContainText('›');
    await expect(dlg(page).getByText('No reach')).toHaveCount(0); // no repeated fallbacks
    await expect(dlg(page).locator('.letter')).toHaveText(/^O\d$/);
    // the figure has the selection ring, and so has its roster row
    await expect(page.locator('#board .selring')).toHaveCount(1);
    await expect(page.locator('.roster li.sel')).toHaveCount(1);
    await shot(page, 'zargon-dialog');
  });

  test('Done goes to the next monster, then the last dialog ends the turn', async ({ page }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await btn(page, 'Done').click();
    await expect(dlg(page)).toContainText('Monster 2 of 2');
    await expect(page.locator('.roster .tickdone')).toHaveCount(1);
    await btn(page, 'Done').click();
    await expect(dlg(page)).toContainText('All monsters have acted');
    await shot(page, 'zargon-final');
    await btn(page, "End Zargon's turn").click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.locator('header .turn')).toContainText('Turn 2');
    await expect(page.locator('.toast')).toContainText("Heroes' turn 2");
    // done marks are cleared for the new turn
    await expect(zbutton(page)).toContainText('2 monsters to act');
    await expect(page.locator('.roster .tickdone')).toHaveCount(0);
  });

  test('close the dialog, press the button again: it resumes at the first monster not done', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await btn(page, 'Done').click();
    await btn(page, 'Back to the map').click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(zbutton(page)).toContainText('1 monster to act');
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('Monster 2 of 2');
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toHaveCount(0);
    // undo of the Done brings the first monster back
    await btn(page, 'Undo').first().click();
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('Monster 1 of 2');
  });

  test('you can end the turn from the last dialog even if you skipped monsters', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2');
    await zbutton(page).click();
    await btn(page, 'Done').click();
    await btn(page, 'Done').click();
    await btn(page, "End Zargon's turn").click();
    await expect(page.locator('header .turn')).toContainText('Turn 2');
  });

  test('no monsters: the last dialog comes first', async ({ page }) => {
    await quest1(page, '');
    await expect(zbutton(page)).toContainText('no monster to act');
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('No monster to act');
    await expect(btn(page, "End Zargon's turn")).toBeVisible();
  });

  test('the same seed gives the same orders after a reload', async ({ page }) => {
    const read = async () => {
      await quest1(page, 'd1,d2', 'dwarf,elf,wizard', 7);
      await zbutton(page).click();
      const first = await dlg(page).innerText();
      await btn(page, 'Done').click();
      return [first, await dlg(page).innerText()];
    };
    const a = await read();
    const b = await read();
    expect(b).toEqual(a);
  });

  test('a fresh wanderer is an info dialog with Next and no Done', async ({ page }) => {
    await quest1(page, 'd1,d2,d3');
    await page.waitForTimeout(900);
    await page.locator('[data-room-cell="9,13"]').click();
    for (const hero of ['Dwarf', 'Elf']) {
      await btn(page, 'Search for treasure').click();
      await btn(page, 'The room is clear, search anyway').click();
      await btn(page, hero).click();
      if (hero === 'Dwarf') {
        await btn(page, 'Continue').click();
        await page.locator('[data-room-cell="9,13"]').click();
      }
    }
    await btn(page, 'It was a wandering monster').click();
    await page.locator('[data-pick-cell="9,13"]').click();
    await expect(dlg(page)).toContainText('attacks the Elf at once');
    await expect(btn(page, 'Placed next to the Elf')).toHaveCount(0); // no choices (decision 33)
    await btn(page, 'Done').click();
    await zbutton(page).click();
    // walk through the acting monsters, the wanderer shows as an info dialog
    for (let i = 0; i < 6; i++) {
      if ((await dlg(page).innerText()).includes('already attacked this round')) break;
      const done = btn(page, 'Done');
      if (await done.count()) await done.click();
      else await btn(page, 'Next').click();
    }
    await expect(dlg(page)).toContainText('Not acting this turn');
    await expect(dlg(page)).toContainText('already attacked this round');
    await expect(btn(page, 'Done')).toHaveCount(0);
    await shot(page, 'zargon-fresh');
    await btn(page, 'Next').click();
    await expect(dlg(page)).toContainText('All monsters have acted');
  });

  test('a caster asks the question of its spell: No shows the next spell, Yes ends its casting', async ({
    page,
  }) => {
    await fixture(page, 'd1');
    await openQuestSheet(page);
    await btn(page, 'Wake the guardian').click();
    await btn(page, 'Done').click();
    await zbutton(page).click();
    const spell = dlg(page).locator('.spell');
    await expect(spell).toContainText('Read the Dread spell card.');
    // when it is cast, and that casting is its action (decision 72)
    await expect(spell).toContainText('Casting is its action, so it does not attack.');
    await expect(spell).toContainText('spell 1 of 2');
    // the tie list is the last thing on the card, after the spell too
    const spellBox = await spell.boundingBox();
    const tieBox = await dlg(page).getByTestId('zargon-tie').boundingBox();
    expect(tieBox!.y).toBeGreaterThan(spellBox!.y + spellBox!.height - 1);
    // the situation tags of Fear and Sleep give their concrete questions (decision 48)
    await expect(spell).toContainText('It casts this spell if any of these is true:');
    await expect(spell).toContainText(
      'Is a hero that rolls 3 or more attack dice right next to it?',
    );
    const first = await spell.locator('.sname b').innerText();
    await shot(page, 'zargon-spell');
    await btn(page, 'No, next spell').click();
    const second = await spell.locator('.sname b').innerText();
    expect(second).not.toBe(first);
    await expect(spell).toContainText('spell 2 of 2');
    await btn(page, 'No, use the plan').click();
    await expect(spell).toHaveCount(0);
    await expect(dlg(page).getByText('Plan', { exact: true })).toBeVisible();
    // undo brings the question back
    await btn(page, 'Back to the map').click();
    await btn(page, 'Undo').first().click();
    await zbutton(page).click();
    await expect(spell).toHaveCount(1);
    await btn(page, 'Yes, it casts it').click();
    await expect(dlg(page)).toContainText('It already cast a spell this turn.');
    await expect(dlg(page).getByText('Plan', { exact: true })).toHaveCount(0);
    await btn(page, 'Done').click();
    await expect(dlg(page)).toContainText('All monsters have acted');
  });

  test('a stone monster is an info dialog with its countdown', async ({ page }) => {
    await fixture(page, 'd1');
    await openQuestSheet(page);
    await btn(page, 'Wake the guardian').click();
    await btn(page, 'Done').click();
    await openQuestSheet(page);
    await btn(page, 'Turn the guardian to stone').click();
    await expect(page.locator('.roster')).toContainText('Stone: 2 turns');
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('Not acting this turn');
    await expect(dlg(page)).toContainText('Stone: 2 turns left');
    await expect(btn(page, 'Done')).toHaveCount(0);
    await shot(page, 'zargon-stone');
    await btn(page, 'Next').click();
    await expect(dlg(page)).toContainText('All monsters have acted');
  });
});

test.describe('heroes who fell (decision 32)', () => {
  test('tap a hero, confirm, the hero is struck through and leaves the tie list; undo works', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2');
    const chip = page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ });
    await expect(page.locator('.hero-chips .chip')).toHaveCount(3);
    await chip.click();
    await expect(dlg(page)).toContainText('Dwarf fell?');
    await shot(page, 'heroes-confirm');
    await btn(page, 'No').click();
    await expect(chip).toBeEnabled();
    await chip.click();
    await btn(page, 'Yes, fell').click();
    await expect(chip).toBeDisabled();
    await expect(chip).toHaveClass(/fallen/);
    await shot(page, 'heroes-block');
    // the dead hero is not in any tie list, and is not offered for a search
    await zbutton(page).click();
    await expect(dlg(page).locator('.tgt')).not.toContainText('Dwarf');
    await btn(page, 'Back to the map').click();
    // undo takes the death back
    await btn(page, 'Undo').first().click();
    await expect(chip).toBeEnabled();
  });

  test('a dead hero cannot search for treasure', async ({ page }) => {
    await quest1(page, 'd1');
    await page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ }).click();
    await btn(page, 'Yes, fell').click();
    await page.locator('[data-room-cell="2,17"]').click();
    await btn(page, 'Search for treasure').click();
    await expect(btn(page, 'Dwarf')).toHaveCount(0);
    await expect(btn(page, 'Elf')).toBeVisible();
  });

  test('when the last hero falls: "All heroes have fallen" with End quest', async ({ page }) => {
    await quest1(page, 'd1,d2', 'dwarf,elf');
    for (const name of [/Dwarf/, /Elf/]) {
      await page.locator('.hero-chips').getByRole('button', { name }).click();
      await btn(page, 'Yes, fell').click();
    }
    const card = page.getByRole('dialog', { name: 'All heroes have fallen' });
    await expect(card).toBeVisible();
    await shot(page, 'heroes-all-fallen');
    await dlg(page).getByRole('button', { name: 'End quest' }).click();
    await expect(dlg(page)).toContainText('How did the quest end?');
    await btn(page, 'All heroes fell').click();
    await expect(dlg(page)).toContainText('Quest over, goal not reached');
  });

  test('the "All heroes have fallen" card shows once, not after every new event', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2', 'dwarf');
    const fallen = page.getByRole('dialog', { name: 'All heroes have fallen' });
    await page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ }).click();
    await btn(page, 'Yes, fell').click();
    await expect(fallen).toBeVisible();
    await btn(page, 'Back to the map').click();
    await expect(fallen).toHaveCount(0);
    // something else happens (a door is opened, with the room it shows): the card stays away
    await page.locator('[data-door="d3"]').click();
    await btn(page, 'Open the door').click();
    for (let i = 0; i < 4; i++) {
      const next = page.getByRole('dialog').getByRole('button', { name: 'Continue' });
      if (await next.count()) await next.first().click();
    }
    await expect(fallen).toHaveCount(0);
    // an Undo that brings the dwarf back, and a new fall, show it again
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click(); // takes the door back
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click(); // takes the fall back
    await expect(fallen).toHaveCount(0);
    await page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ }).click();
    await btn(page, 'Yes, fell').click();
    await expect(fallen).toBeVisible();
  });

  test("Zargon's turn with every hero fallen offers End quest", async ({ page }) => {
    await quest1(page, 'd1,d2', 'dwarf');
    await page.locator('.hero-chips').getByRole('button', { name: /Dwarf/ }).click();
    await btn(page, 'Yes, fell').click();
    await btn(page, 'Back to the map').click();
    await zbutton(page).click();
    await expect(dlg(page)).toContainText('All heroes have fallen');
    await dlg(page).getByRole('button', { name: 'End quest' }).click();
    await expect(dlg(page)).toContainText('How did the quest end?');
  });
});
