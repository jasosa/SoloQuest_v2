import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

const board = (page: Page) => page.locator('#editor-board');
/** Click the middle of a square (or a point `fx`, `fy` squares in) of the editor board. */
async function clickAt(page: Page, x: number, y: number, fx = 0.5, fy = 0.5) {
  const box = (await board(page).boundingBox())!;
  const k = box.width / (26 * 34 + 4);
  await page.mouse.click(box.x + ((x + fx) * 34 + 2) * k, box.y + ((y + fy) * 34 + 2) * k);
}
const mergeTool = (page: Page) =>
  page.locator('.ed-tools').getByRole('button', { name: 'Merge rooms', exact: true });

async function newQuest(page: Page, title = 'Maps test') {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^New quest/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await btn(page, 'Create the quest').click();
  await expect(page.locator('header.page-head h1')).toHaveText(title);
}

async function openHeartOfIce(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^Open quest/ }).click();
  await page.getByLabel('Bundled quest').selectOption('109');
  await btn(page, 'Edit it now').click();
  await expect(page.locator('header.page-head h1')).toContainText('The Heart of Ice');
}

test.describe('editor: double quests', () => {
  test('the bundled double quest shows both maps with their pieces and the stairs link', async ({
    page,
  }) => {
    await openHeartOfIce(page);
    const maps = page.getByTestId('map-tabs');
    await expect(maps.getByRole('tab')).toHaveCount(2);
    await expect(maps.getByRole('tab', { name: 'The Frozen Halls' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // map 1
    await expect(page.locator('[data-monster]')).toHaveCount(61);
    await expect(page.locator('[data-trap]')).toHaveCount(12);
    await expect(page.locator('[data-furniture="f-h-stairs"]')).toHaveCount(1);
    await expect(page.locator('[data-furniture="f-c-stairs"]')).toHaveCount(0);
    // map 2
    await maps.getByRole('tab', { name: 'The Catacombs' }).click();
    await expect(page.locator('[data-monster]')).toHaveCount(69);
    await expect(page.locator('[data-trap]')).toHaveCount(17);
    await expect(page.locator('[data-furniture="f-c-stairs"]')).toHaveCount(1);
    await expect(page.locator('[data-furniture="f-h-stairs"]')).toHaveCount(0);
    // the Map tab: the Merge rooms tool shows the merged rooms of the map on show
    await page
      .locator('.ed-tools')
      .getByRole('button', { name: 'Merge rooms', exact: true })
      .click();
    await expect(page.getByTestId('merge-row')).toContainText('R14 is part of R13');
    await maps.getByRole('tab', { name: 'The Frozen Halls' }).click();
    await expect(page.getByTestId('merge-row')).toHaveCount(0);
    // the Quest tab: two maps and the link, and no merged rooms there
    await tab(page, 'Quest').click();
    await expect(page.getByTestId('map-row')).toHaveCount(2);
    await expect(page.getByTestId('link-row')).toHaveCount(1);
    await expect(page.getByTestId('link-row')).toContainText('The Frozen Halls');
    await expect(page.getByTestId('link-row')).toContainText('The Catacombs');
    await expect(page.getByTestId('merges-panel')).toHaveCount(0);
  });

  test('a link can be removed and joined again from two stairways, and undone', async ({
    page,
  }) => {
    await openHeartOfIce(page);
    await tab(page, 'Quest').click();
    await btn(page, 'Remove link l1').click();
    await expect(page.getByTestId('link-row')).toHaveCount(0);
    await page.getByLabel('First stairway').selectOption({ label: 'The Frozen Halls: f-h-stairs' });
    await page.getByLabel('Second stairway').selectOption({ label: 'The Catacombs: f-c-stairs' });
    await page.getByTestId('join-link').click();
    await expect(page.getByTestId('link-row')).toHaveCount(1);
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('link-row')).toHaveCount(0);
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('link-row')).toHaveCount(1);
  });

  test('joining with no stairway on a map is refused with a hint', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    await btn(page, 'New map').click();
    await expect(page.getByTestId('map-row')).toHaveCount(2);
    await expect(
      page.getByText('Put a stairway (furniture) on each map to join them.'),
    ).toBeVisible();
    await page.getByTestId('join-link').click();
    await expect(page.getByText('Pick the two stairways to join.')).toBeVisible();
  });

  test('new map, switch, edit on map 2 only, rename, delete, undo', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    await btn(page, 'New map').click();
    await tab(page, 'Map').click();
    const maps = page.getByTestId('map-tabs');
    await expect(maps.getByRole('tab')).toHaveCount(2);
    await maps.getByRole('tab', { name: 'map2' }).click();
    // no stairs on map 2, and a monster placed here stays here
    await expect(page.locator('[data-furniture]')).toHaveCount(0);
    await btn(page, 'Monsters').click();
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    await page.mouse.click(box.x + (10.5 * 34 + 2) * k, box.y + (2.5 * 34 + 2) * k);
    await expect(page.locator('[data-monster]')).toHaveCount(1);
    await maps.getByRole('tab', { name: 'map1' }).click();
    await expect(page.locator('[data-monster]')).toHaveCount(0);
    await expect(page.locator('[data-furniture="f-stairs"]')).toHaveCount(1);
    // rename map 2
    await tab(page, 'Quest').click();
    const name = page.getByLabel('Map map2 name');
    await name.fill('Below');
    await name.blur();
    await tab(page, 'Map').click();
    await expect(maps.getByRole('tab', { name: 'Below' })).toBeVisible();
    // delete it: back to one map, the tabs row is gone
    await tab(page, 'Quest').click();
    await btn(page, 'Delete map map2').click();
    await expect(page.getByTestId('map-row')).toHaveCount(0);
    await tab(page, 'Map').click();
    await expect(page.getByTestId('map-tabs')).toHaveCount(0);
    // undo brings the map and its monster back
    await btn(page, 'Undo').click();
    await expect(page.getByTestId('map-tabs').getByRole('tab')).toHaveCount(2);
    await page.getByTestId('map-tabs').getByRole('tab', { name: 'Below' }).click();
    await expect(page.locator('[data-monster]')).toHaveCount(1);
  });

  test('an action can be scoped to a map', async ({ page }) => {
    await openHeartOfIce(page);
    await tab(page, 'Actions').click();
    await page.getByTestId('actions-list').getByRole('button').first().click();
    const form = page.getByTestId('action-card');
    await expect(form.getByRole('combobox', { name: 'Map', exact: true })).toBeVisible();
    const before = await form.getByRole('combobox', { name: 'Map', exact: true }).inputValue();
    expect(['', 'halls', 'catacombs']).toContain(before);
    await form
      .getByRole('combobox', { name: 'Map', exact: true })
      .selectOption(before === 'halls' ? '' : 'halls');
    await expect(form.getByRole('combobox', { name: 'Map', exact: true })).toHaveValue(
      before === 'halls' ? '' : 'halls',
    );
  });

  test('merged rooms: tap two rooms that touch to merge them, refuse two that do not, split', async ({
    page,
  }) => {
    await newQuest(page);
    await mergeTool(page).click();
    const merges = page.getByTestId('map-merges');
    // room ids are drawn while the tool is on
    await expect(board(page).locator('text', { hasText: 'R20' })).toHaveCount(1);
    await expect(merges.getByTestId('merge-rooms')).toBeDisabled();
    // the first room tapped stays, the second joins it
    await clickAt(page, 1, 15); // R20
    await expect(merges.getByTestId('merge-slot-a')).toContainText('R20');
    await expect(merges.getByTestId('merge-slot-b')).toContainText('Tap a room');
    await clickAt(page, 7, 15); // R17
    await expect(merges.getByTestId('merge-slot-b')).toContainText('R17');
    await expect(merges.getByTestId('merge-rooms')).toHaveText('Merge R17 into R20');
    await merges.getByTestId('merge-rooms').click();
    await expect(merges.getByTestId('merge-row')).toContainText('R17 is part of R20');
    // the slots are empty again
    await expect(merges.getByTestId('merge-slot-a')).toContainText('Tap a room');
    // a tap on a row picks it (its merged room is ringed on the board), a second tap drops it
    const pickRow = merges.getByTestId('merge-row').locator('.mg-pick');
    await pickRow.click();
    await expect(pickRow).toHaveAttribute('aria-pressed', 'true');
    await pickRow.click();
    await expect(pickRow).toHaveAttribute('aria-pressed', 'false');
    // a room that does not touch: the engine sentence is inline, the button is off, nothing is merged
    await clickAt(page, 3, 2); // R01
    await clickAt(page, 17, 3); // R05
    await expect(merges.getByTestId('merge-error')).toContainText(
      'Cannot merge: the rooms do not touch',
    );
    await expect(merges.getByTestId('merge-rooms')).toBeDisabled();
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(merges.getByTestId('merge-row')).toHaveCount(1);
    // the corridor does nothing and says nothing
    await clickAt(page, 0, 0);
    await expect(merges.getByTestId('merge-slot-a')).toContainText('R01');
    await expect(merges.getByTestId('merge-slot-b')).toContainText('R05');
    // a tap on a room that is merged away is refused, and the slots stay
    await clickAt(page, 7, 15);
    await expect(merges.getByTestId('merge-error')).toHaveText(
      'R17 is part of R20. Split it first.',
    );
    await expect(merges.getByTestId('merge-slot-b')).toContainText('R05');
    // a tap on a picked room takes it out; Clear empties both slots
    await clickAt(page, 17, 3);
    await expect(merges.getByTestId('merge-slot-b')).toContainText('Tap a room');
    await expect(merges.getByTestId('merge-error')).toHaveCount(0);
    await merges.getByRole('button', { name: 'Clear' }).click();
    await expect(merges.getByTestId('merge-slot-a')).toContainText('Tap a room');
    // Split, one undo step each
    await btn(page, 'Split room R17').click();
    await expect(merges.getByTestId('merge-row')).toHaveCount(0);
    await btn(page, 'Undo').click();
    await expect(merges.getByTestId('merge-row')).toHaveCount(1);
    await btn(page, 'Undo').click();
    await expect(merges.getByTestId('merge-row')).toHaveCount(0);
  });

  test('merged rooms: a door on the wall between the rooms refuses the merge, inline', async ({
    page,
  }) => {
    await newQuest(page);
    await page.locator('.ed-tools').getByRole('button', { name: 'Doors', exact: true }).click();
    await clickAt(page, 6, 11, 0.97, 0.5); // the wall between R13 and R14
    await expect(page.locator('[data-door="d1"]')).toHaveCount(1);
    await mergeTool(page).click();
    const merges = page.getByTestId('map-merges');
    await clickAt(page, 5, 10); // R13
    await clickAt(page, 7, 10); // R14
    await expect(merges.getByTestId('merge-error')).toHaveText(
      'Cannot merge: door d1 is on the wall between them. Remove it first.',
    );
    await expect(merges.getByTestId('merge-rooms')).toBeDisabled();
    await expect(merges.getByTestId('merge-rooms')).toHaveText('Merge R14 into R13');
    await expect(page.locator('.toast')).toHaveCount(0);
    // the door that stops the merge is ringed on the board
    await expect(page.locator('[data-merge-door="d1"]')).toHaveCount(1);
    // after the door is gone, the same pair merges
    await page.locator('.ed-tools').getByRole('button', { name: 'Select', exact: true }).click();
    await clickAt(page, 6, 11, 0.97, 0.5);
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-door="d1"]')).toHaveCount(0);
    await mergeTool(page).click();
    await clickAt(page, 5, 10);
    await clickAt(page, 7, 10);
    await expect(merges.getByTestId('merge-error')).toHaveCount(0);
    await merges.getByTestId('merge-rooms').click();
    await expect(merges.getByTestId('merge-row')).toContainText('R14 is part of R13');
    // one outline: the wall that was between the rooms is a dashed line, and R14 has no id of its own
    await expect(page.locator('[data-merged-wall]')).toHaveCount(3);
    await expect(board(page).locator('text', { hasText: /^R14$/ })).toHaveCount(0);
    await expect(board(page).locator('text', { hasText: /^R13$/ })).toHaveCount(1);
    // a picked row rings the merged room
    await merges.getByTestId('merge-row').locator('.mg-pick').click();
    await expect(page.locator('[data-merge-door]')).toHaveCount(0);
    await page.locator('.ed-tools').getByRole('button', { name: 'Select', exact: true }).click();
    await expect(page.locator('[data-merged-wall]')).toHaveCount(3);
    // the door tool refuses a door on that wall, inline in its own card
    await page.locator('.ed-tools').getByRole('button', { name: 'Doors', exact: true }).click();
    await clickAt(page, 6, 11, 0.97, 0.5);
    await expect(page.getByTestId('tool-error')).toHaveText(
      'Cannot add a door: R13 and R14 are one room. Split them first.',
    );
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(page.locator('[data-door]')).toHaveCount(0);
    // the sentence goes away with the next tap, and a wall of another room still takes a door
    await clickAt(page, 4, 11, 0.97, 0.5);
    await expect(page.getByTestId('tool-error')).toHaveCount(0);
    await expect(page.locator('[data-door]')).toHaveCount(1);
  });

  test('rules: door teleport, and a large monster', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    const dice = page.getByLabel('Door teleport dice');
    const squares = page.getByLabel('Door teleport squares');
    await dice.fill('1 red die');
    await dice.blur();
    await squares.fill('that many squares');
    await squares.blur();
    await expect(dice).toHaveValue('1 red die');
    await dice.fill('');
    await dice.blur();
    await squares.fill('');
    await squares.blur();
    await expect(dice).toHaveValue('');

    await tab(page, 'Monsters').click();
    await btn(page, 'Add').click();
    const size = page.getByLabel('Monster size');
    await size.selectOption('2');
    await expect(size).toHaveValue('2');
    await size.selectOption('');
    await expect(size).toHaveValue('');
  });

  test('a double quest exports the same file from either map', async ({ page }) => {
    await openHeartOfIce(page);
    const [first] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export').click(),
    ]);
    const text = readFileSync((await first.path())!, 'utf8');
    const data = JSON.parse(text) as { maps: unknown[]; links: unknown[]; mapId: string };
    expect(data.maps).toHaveLength(1);
    expect(data.links).toHaveLength(1);
    expect(data.mapId).toBe('halls');
    await page.getByTestId('map-tabs').getByRole('tab', { name: 'The Catacombs' }).click();
    const [again] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export').click(),
    ]);
    expect(readFileSync((await again.path())!, 'utf8')).toBe(text);
  });
});
