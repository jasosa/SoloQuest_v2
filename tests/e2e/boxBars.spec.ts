import { expect, test, type Locator, type Page } from '@playwright/test';

// The colours of the bars (DESIGN.md, "Colour bars"): the box colour from My collection, neutral for
// what the player made. Defaults: base game rgb(110, 31, 42), Frozen Horror rgb(59, 107, 140), the
// neutral token --muted rgb(109, 90, 78).
const CORE = 'rgb(110, 31, 42)';
const FROZEN = 'rgb(59, 107, 140)';
const MUTED = 'rgb(109, 90, 78)';

const bar = (l: Locator) => l.evaluate((e) => getComputedStyle(e).borderLeftColor);

async function newQuest(page: Page, title: string) {
  await page.getByRole('button', { name: /^New quest/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
  await expect(page.locator('header.page-head h1')).toHaveText(title);
}

test.describe('colour bars follow the box', () => {
  test('Play a quest: a core quest card has the base game bar, a Frozen Horror card the ice bar', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-core').click();
    expect(await bar(page.locator('.qcard.bar').first())).toBe(CORE);
    await page.getByTestId('pack-frozen-horror').click();
    expect(await bar(page.locator('.qcard.bar').first())).toBe(FROZEN);
    await page.screenshot({ path: 'test-results/bars-play-a-quest.png' });
  });

  test('the box colour set in My collection moves the bars', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-collection').click();
    await page.getByTestId('color-frozen-horror').fill('#336699');
    await page.getByTestId('collection-done').click();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-frozen-horror').click();
    expect(await bar(page.locator('.qcard.bar').first())).toBe('rgb(51, 102, 153)');
  });

  test('editor start list: a quest made here is neutral, a copy of a Frozen Horror quest keeps its box', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await newQuest(page, 'Made here');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    // a copy of a printed quest of an expansion
    await page.getByRole('button', { name: /^Open quest/ }).click();
    await page.getByLabel('Bundled quest').selectOption('102');
    await page.getByRole('button', { name: 'Make a copy', exact: true }).click();
    const rows = page.locator('li[data-quest]');
    await expect(rows.filter({ hasText: 'Made here' })).toHaveCount(1);
    expect(await bar(rows.filter({ hasText: 'Made here' }))).toBe(MUTED);
    const copy = rows.filter({ hasText: 'Trial' });
    await expect(copy).toHaveCount(1);
    expect(await bar(copy)).toBe(FROZEN);
    await page.screenshot({ path: 'test-results/bars-editor-start.png' });
  });

  test('Library: a Frozen Horror enemy has the ice bar, one made here is neutral, the kinds are neutral', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^Library/ }).click();
    const lib = page.getByTestId('dz-library');
    await lib.getByRole('button', { name: /^Enemies/ }).click();
    const items = page.getByTestId('dz-items');
    expect(await bar(lib.getByRole('button', { name: /^Enemies/ }))).toBe(MUTED);
    expect(await bar(items.locator('.qcard', { hasText: 'Ice Gremlin' }))).toBe(FROZEN);
    expect(await bar(items.locator('.qcard', { hasText: /^Orc/ }))).toBe(CORE);
    await items.getByRole('button', { name: 'New enemy', exact: true }).click();
    await page.getByTestId('dz-card').getByLabel('Name', { exact: true }).fill('Slimey');
    expect(await bar(items.locator('.qcard', { hasText: 'Slimey' }))).toBe(MUTED);
    await page.screenshot({ path: 'test-results/bars-library.png' });
  });

  test('Actions tab rows are neutral; Monsters tab rows follow the enemy box', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await newQuest(page, 'Rows');
    await page.getByRole('tab', { name: 'Actions', exact: true }).click();
    await page.getByTestId('actions-list').getByRole('button', { name: 'Add action' }).click();
    await page.getByRole('button', { name: 'Save action', exact: true }).click();
    expect(await bar(page.getByTestId('note-list').getByRole('button').first())).toBe(MUTED);
    await page.screenshot({ path: 'test-results/bars-actions.png' });

    // a core monster and a Frozen Horror one
    await page.getByRole('tab', { name: 'Map', exact: true }).click();
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const place = async (kindName: RegExp, monster: string, x: number, y: number) => {
      const back = page.getByRole('button', { name: 'Back to the kinds' });
      if (await back.isVisible()) await back.click();
      await page.getByTestId('monster-kind-list').getByRole('button', { name: kindName }).click();
      await page.locator('.mk-card').filter({ hasText: monster }).first().click();
      const box = (await page.locator('#editor-board').boundingBox())!;
      const k = box.width / (26 * 34 + 4);
      await page.mouse.click(box.x + ((x + 0.5) * 34 + 2) * k, box.y + ((y + 0.5) * 34 + 2) * k);
    };
    await place(/^Core game/, 'Orc', 4, 17);
    await place(/^Frozen Horror/, 'Yeti', 5, 17);
    await page.getByRole('tab', { name: 'Monsters', exact: true }).click();
    const rows = page.locator('[data-monster-row]');
    await expect(rows).toHaveCount(2);
    expect(await bar(rows.filter({ hasText: 'Orc' }))).toBe(CORE);
    expect(await bar(rows.filter({ hasText: 'Yeti' }))).toBe(FROZEN);
    await page.screenshot({ path: 'test-results/bars-monsters-tab.png' });
  });

  test('Map tab Monsters kinds: boxes have their colour, This quest and My library are neutral', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await newQuest(page, 'Kinds');
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const list = page.getByTestId('monster-kind-list');
    expect(await bar(list.getByRole('button', { name: /^Core game/ }))).toBe(CORE);
    expect(await bar(list.getByRole('button', { name: /^Frozen Horror/ }))).toBe(FROZEN);
    expect(await bar(list.getByRole('button', { name: /^My library/ }))).toBe(MUTED);
  });
});
