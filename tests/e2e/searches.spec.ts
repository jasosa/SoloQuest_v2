import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(350); // let the pop animation finish
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const dialog = (page: Page) => page.getByRole('dialog');
const roomCell = (page: Page, key: string) => page.locator(`[data-room-cell="${key}"]`);
const trap = (page: Page, id: string) => page.locator(`[data-trap="${id}"]`);
const rows = (page: Page) => page.locator('.roster li:not(.empty)');

const quest1 = (page: Page, open: string, team = 'dwarf,elf') =>
  page.goto(`/?quest=1&team=${team}&nosave=1&seed=1&open=${open}`);
const fixture = (page: Page, open: string, extra = '') =>
  page.goto(`/?quest=test&team=dwarf,elf&nosave=1&seed=1&open=${open}${extra}`);

test.describe('treasure and wandering monster (quest 1)', () => {
  test('first search of R18 gives note A, the next hero draws a card, the searcher is greyed', async ({
    page,
  }) => {
    await quest1(page, 'd1,d2,d3');
    await page.waitForTimeout(900);
    await roomCell(page, '9,13').click();
    await expect(dialog(page)).toContainText('Search this room');
    await shot(page, 'room-menu');
    await btn(page, 'Search for treasure').click();

    // monsters are still in R18: a warning, the heroes are locked until the override
    await expect(dialog(page)).toContainText('still here');
    await expect(btn(page, 'Dwarf')).toBeDisabled();
    await shot(page, 'room-guard');
    await btn(page, 'The room is clear, search anyway').click();
    await expect(btn(page, 'Dwarf')).toBeEnabled();
    await btn(page, 'Dwarf').click();
    await expect(page.getByRole('dialog', { name: 'Note A' })).toContainText('rusty');
    await shot(page, 'search-note');
    await btn(page, 'Continue').click();

    // the next hero draws a card; the Dwarf cannot search this room again
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await expect(btn(page, 'Dwarf')).toBeDisabled();
    await btn(page, 'Elf').click();
    await expect(dialog(page)).toContainText('Draw a treasure card');
    await shot(page, 'search-card');

    // it was a wandering monster
    await btn(page, 'It was a wandering monster').click();
    // the question comes first: nothing is added until one of the two buttons is pressed
    await expect(dialog(page)).toContainText('Was there a free square next to the Elf?');
    await expect(rows(page)).toHaveCount(4);
    await shot(page, 'wandering-card');
    await btn(page, 'Placed next to the Elf').click();
    await expect(dialog(page)).toContainText('attacks the Elf at once');
    await btn(page, 'Done').click();
    const wanderer = rows(page).filter({ hasText: 'Wandering · next to the Elf' });
    await expect(wanderer).toHaveCount(1);
    await expect(rows(page)).toHaveCount(5); // 4 seen monsters + the wanderer
    await shot(page, 'wandering-roster');
    // the wanderer has a callout but no token
    await wanderer.click();
    await expect(dialog(page)).toContainText('Wandering');
  });

  test('no free square: the wanderer joins the roster and acts next turn', async ({ page }) => {
    await quest1(page, 'd1,d2,d3');
    await page.waitForTimeout(900);
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Dwarf').click();
    await btn(page, 'Continue').click();
    await roomCell(page, '9,13').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Elf').click();
    await btn(page, 'It was a wandering monster').click();
    await btn(page, 'No free square next to the Elf').click();
    await expect(dialog(page)).toContainText("acts in Zargon's next turn");
    await btn(page, 'Done').click();
    await expect(rows(page)).toHaveCount(5);
  });

  test('a search in a room without monsters needs no override', async ({ page }) => {
    await quest1(page, 'd1');
    await roomCell(page, '2,17').click();
    await btn(page, 'Search for treasure').click();
    await expect(dialog(page)).not.toContainText('still here');
    await btn(page, 'Barbarian').or(btn(page, 'Dwarf')).click();
    await expect(dialog(page)).toContainText('Draw a treasure card');
  });
});

test.describe('secret doors', () => {
  test('quest 1: nothing found from a room and from a corridor square', async ({ page }) => {
    await quest1(page, 'd1');
    await roomCell(page, '2,17').click();
    await btn(page, 'Search for secret doors').click();
    await btn(page, 'Elf').click();
    await expect(dialog(page)).toContainText('Nothing found');
    await shot(page, 'secret-nothing');
    await btn(page, 'Done').click();

    await page.locator('[data-cell="4,18"]').click();
    await btn(page, 'Search for secret doors').click();
    await btn(page, 'Dwarf').click();
    await expect(dialog(page)).toContainText('Nothing found');
  });

  test('fixture: a found secret door appears on the map and opens like a door', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await expect(page.locator('[data-door="s1"]')).toHaveCount(0);
    await roomCell(page, '5,17').click();
    await btn(page, 'Search for secret doors').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Elf').click();
    await expect(dialog(page)).toContainText('A secret door!');
    await shot(page, 'secret-found');
    await btn(page, 'Done').click();
    await page.locator('[data-door="s1"]').click();
    await btn(page, 'Open the door').click();
    await expect(page.locator('[data-door="s1"]')).toHaveCount(0); // open now
  });
});

test.describe('traps (dev fixture)', () => {
  test('spear: jump with a skull springs it and it vanishes', async ({ page }) => {
    await fixture(page, 'd1');
    await page.waitForTimeout(900);
    await trap(page, 't3').click();
    await expect(dialog(page)).toContainText('Something is wrong here');
    await shot(page, 'trap-menu');
    await btn(page, 'Jump over it').click();
    await expect(dialog(page)).toContainText('Roll 1 combat die');
    await shot(page, 'trap-jump');
    await btn(page, 'Skull').click();
    await expect(dialog(page)).toContainText('Spear trap!');
    await expect(dialog(page)).toContainText('The jump failed');
    await shot(page, 'trap-sprung-spear');
    await btn(page, 'Done').click();
    await expect(trap(page, 't3')).toHaveCount(0);
  });

  test('jump with no skull leaves the trap', async ({ page }) => {
    await fixture(page, 'd1');
    await trap(page, 't3').click();
    await btn(page, 'Jump over it').click();
    await btn(page, 'No skull').click();
    await expect(dialog(page)).toContainText('You land safely');
    await btn(page, 'Done').click();
    await expect(trap(page, 't3')).toHaveCount(1);
  });

  test('disarm: the Dwarf and a tool kit, and the kind is told', async ({ page }) => {
    await fixture(page, 'd1');
    await trap(page, 't3').click();
    await btn(page, 'Try to disarm it').click();
    await shot(page, 'trap-who');
    await btn(page, 'The Dwarf').click();
    await expect(dialog(page)).toContainText('black shield');
    await btn(page, 'Other').click();
    await expect(dialog(page)).toContainText('It was a spear trap');
    await btn(page, 'Done').click();
    await expect(trap(page, 't3')).toHaveCount(0);

    await trap(page, 't4').click();
    await btn(page, 'Try to disarm it').click();
    await btn(page, 'A hero with a tool kit').click();
    await btn(page, 'Skull').click(); // a skull springs it
    await expect(dialog(page)).toContainText('Falling block!');
  });

  test('falling block becomes a block on the map', async ({ page }) => {
    await fixture(page, 'd1');
    await page.waitForTimeout(900);
    await trap(page, 't4').click();
    await btn(page, 'Step onto it').click();
    await expect(dialog(page)).toContainText('wall');
    await btn(page, 'Done').click();
    await expect(trap(page, 't4')).toHaveCount(0);
    await expect(page.locator('[data-block="6,18"]')).toHaveCount(1);
    await shot(page, 'trap-block');
  });

  test('a sprung pit stays on the map and cannot be disarmed', async ({ page }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await trap(page, 't1').click();
    await btn(page, 'Step onto it').click();
    await expect(dialog(page)).toContainText('Pit trap!');
    await shot(page, 'trap-sprung-pit');
    await btn(page, 'Done').click();
    await expect(trap(page, 't1')).toHaveCount(1);
    await trap(page, 't1').click();
    await expect(btn(page, 'Try to disarm it')).toBeDisabled();
    await shot(page, 'trap-pit-tile');
    await btn(page, 'Jump over it').click();
    await btn(page, 'No skull').click();
    await expect(dialog(page)).toContainText('You land safely');
  });

  test('chest: no "?" before a search; a search finds the trap, then disarm is the only way', async ({
    page,
  }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await expect(trap(page, 't2')).toHaveCount(0); // hidden until found
    await page.locator('[data-chest="f1"]').click();
    await expect(dialog(page)).toContainText('Look for traps');
    // the orc is in the room: guard first
    await expect(dialog(page)).toContainText('still here');
    await expect(btn(page, 'Search for traps')).toBeDisabled();
    await shot(page, 'chest-guard');
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Search for traps').click();
    await expect(dialog(page)).toContainText('You found a trap');
    await expect(dialog(page)).toContainText('a treasure search here springs it');
    await shot(page, 'chest-trap-found');
    await btn(page, 'Done').click();
    await expect(trap(page, 't2')).toHaveCount(1);

    // searched once: no second search is offered, only the disarm
    await page.locator('[data-chest="f1"]').click({ position: { x: 60, y: 22 } });
    await expect(btn(page, 'Search for traps')).toHaveCount(0);
    await btn(page, 'Try to disarm it').click();
    await btn(page, 'The Dwarf').click();
    await btn(page, 'Other').click();
    await expect(dialog(page)).toContainText('It was a chest trap');
    await btn(page, 'Done').click();
    await expect(trap(page, 't2')).toHaveCount(0);
  });

  test('chest trap: jump and step are not offered on the found trap', async ({ page }) => {
    await fixture(page, 'd1,d2');
    await page.locator('[data-chest="f1"]').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Search for traps').click();
    await btn(page, 'Done').click();
    await trap(page, 't2').click();
    await expect(btn(page, 'Jump over it')).toBeDisabled();
    await expect(btn(page, 'Step onto it')).toBeDisabled();
    await expect(btn(page, 'Try to disarm it')).toBeEnabled();
  });

  test('a hidden chest trap springs on a treasure search, before the result', async ({ page }) => {
    await fixture(page, 'd1,d2');
    await page.waitForTimeout(900);
    await roomCell(page, '5,17').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Dwarf').click();
    await expect(dialog(page)).toContainText('Chest trap!');
    await expect(dialog(page)).toContainText('Draw a treasure card');
    await shot(page, 'trap-chest-search');
    await btn(page, 'Done').click();
  });

  test('quest 1: a chest with no trap says so, and cannot be searched twice', async ({ page }) => {
    await quest1(page, 'd1,look@13:18,d5');
    await page.waitForTimeout(900);
    await page.locator('[data-chest="f-chest-b"]').click();
    await expect(dialog(page)).toContainText('still here'); // two dread warriors
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Search for traps').click();
    await expect(dialog(page)).toContainText('No trap on this chest.');
    await shot(page, 'chest-no-trap');
    await btn(page, 'Done').click();
    await page.locator('[data-chest="f-chest-b"]').click();
    await expect(dialog(page)).toContainText('Already searched');
    await expect(btn(page, 'Search for traps')).toHaveCount(0);
    await shot(page, 'chest-searched');
  });

  test('undo takes a sprung trap back', async ({ page }) => {
    await fixture(page, 'd1');
    await trap(page, 't3').click();
    await btn(page, 'Step onto it').click();
    await btn(page, 'Done').click();
    await expect(trap(page, 't3')).toHaveCount(0);
    await btn(page, 'Undo').first().click();
    await expect(trap(page, 't3')).toHaveCount(1);
  });
});
