import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function newQuest(page: Page, title = 'Maps test') {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^NEW QUEST/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await btn(page, 'Create the quest').click();
  await expect(page.locator('.fr-title')).toHaveText(title);
}

async function openHeartOfIce(page: Page) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
  await page.getByLabel('Bundled quest').selectOption('109');
  await btn(page, 'Edit it now').click();
  await expect(page.locator('.fr-title')).toContainText('The Heart of Ice');
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
    // the Quest tab: two maps, the link, and the merged rooms of the map on show
    await tab(page, 'Quest').click();
    await expect(page.getByTestId('map-row')).toHaveCount(2);
    await expect(page.getByTestId('link-row')).toHaveCount(1);
    await expect(page.getByTestId('link-row')).toContainText('The Frozen Halls');
    await expect(page.getByTestId('link-row')).toContainText('The Catacombs');
    await expect(page.getByTestId('merge-row')).toContainText('R14 is part of R13');
    await tab(page, 'Map').click();
    await maps.getByRole('tab', { name: 'The Frozen Halls' }).click();
    await tab(page, 'Quest').click();
    await expect(page.getByTestId('merge-row')).toHaveCount(0);
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

  test('merged rooms: merge two rooms that touch, refuse two that do not, split', async ({
    page,
  }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    const merges = page.getByTestId('quest-merges');
    await merges.getByLabel('Main room').selectOption('R20');
    await merges.getByLabel('Room that joins it').selectOption('R17');
    await merges.getByTestId('merge-rooms').click();
    await expect(merges.getByTestId('merge-row')).toContainText('R17 is part of R20');
    await merges.getByLabel('Main room').selectOption('R01');
    await merges.getByLabel('Room that joins it').selectOption('R05');
    await merges.getByTestId('merge-rooms').click();
    await expect(merges.getByTestId('merge-row')).toHaveCount(1);
    await expect(page.getByText(/Cannot merge/)).toBeVisible();
    await btn(page, 'Split room R17').click();
    await expect(merges.getByTestId('merge-row')).toHaveCount(0);
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
