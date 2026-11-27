import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { dismissStart, gotoQuest, openQuest, openQuestSheet } from './helpers';

const strip = (page: Page) => page.locator('.team-strip');
const coin = (page: Page, name: RegExp | string) =>
  strip(page).getByRole('button', { name: name as RegExp });
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450); // let the note settle
  await page.screenshot({ path: `test-results/${name}.png` });
};
const play = (page: Page, team = 'dwarf,elf,wizard') =>
  gotoQuest(page, `/?quest=1&team=${team}&nosave=1&seed=5&open=d1`);

test.describe('the team strip above the board', () => {
  test('layout: 44 px target, coin of 30 px, the board keeps 34 px squares and clears the zoom buttons', async ({
    page,
  }) => {
    await play(page, 'barbarian,dwarf,elf,wizard');
    await expect(strip(page).locator('.team-btn')).toHaveText(['B', 'D', 'E', 'W']);
    const header = (await page.locator('header').boundingBox())!;
    const s = (await strip(page).boundingBox())!;
    expect(s.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(s.height).toBe(58);
    for (const b of await strip(page).locator('.team-btn').all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBe(44);
      expect(box.height).toBe(44);
      const c = (await b.locator('.coin').boundingBox())!;
      expect(c.width).toBe(30);
    }
    // the coins are centered between the title band line and the board's red border
    const board0 = (await page.locator('#board').boundingBox())!;
    const c0 = (await strip(page).locator('.coin').first().boundingBox())!;
    const above = c0.y - (header.y + header.height);
    const below = board0.y + 0.5 - (c0.y + c0.height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
    // the board is as large as before (34 px a square, 884 px wide) and under the strip
    const board = (await page.locator('#board').boundingBox())!;
    expect(board.y).toBeGreaterThanOrEqual(s.y + s.height);
    expect(Math.abs(board.width / 26 - 34)).toBeLessThan(0.6);
    const zoom = (await page.getByRole('group', { name: 'Zoom' }).boundingBox())!;
    expect(board.y + board.height).toBeLessThanOrEqual(zoom.y);
    // the right column no longer has a Heroes block
    await expect(page.locator('aside').getByText('Heroes', { exact: true })).toHaveCount(0);
    await shot(page, 'teamstrip-idle');
  });

  test('tap a hero: a note under the coin asks "fell?", No and a second tap close it', async ({
    page,
  }) => {
    await play(page);
    const dwarf = coin(page, /^D, Dwarf/);
    await dwarf.click();
    const note = page.getByRole('dialog', { name: 'Dwarf fell?' });
    await expect(note).toBeVisible();
    await expect(note).not.toContainText('tie list');
    const c = (await dwarf.boundingBox())!;
    const n = (await note.boundingBox())!;
    expect(n.y).toBeGreaterThanOrEqual(c.y + c.height); // under the coin
    expect(Math.abs(n.x + 20 - (c.x + c.width / 2))).toBeLessThan(40); // anchored at the coin
    await shot(page, 'teamstrip-ask');
    await btn(page, 'No').click();
    await expect(note).toHaveCount(0);
    await dwarf.click();
    await expect(note).toBeVisible();
    await dwarf.click(); // a second tap closes it
    await expect(note).toHaveCount(0);
    await dwarf.click();
    await page.keyboard.press('Escape');
    await expect(note).toHaveCount(0);
    await dwarf.click();
    await page.locator('#board').click({ position: { x: 300, y: 300 } }); // a tap on the map
    await expect(note).toHaveCount(0);
    // another coin takes the note
    await dwarf.click();
    await coin(page, /^E, Elf/).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Elf fell?' })).toBeVisible();
  });

  test('Yes, fell: the coin turns grey, struck, keeps its place; undo brings it back', async ({
    page,
  }) => {
    await play(page);
    await coin(page, /^D, Dwarf/).click();
    await btn(page, 'Yes, fell').click();
    const fallen = coin(page, /^D, Dwarf, fell$/);
    await expect(fallen).toBeDisabled();
    await expect(fallen).toHaveClass(/fallen/);
    // it keeps its place
    await expect(strip(page).locator('.team-btn')).toHaveText(['D', 'E', 'W']);
    const coinEl = fallen.locator('.coin');
    await expect(coinEl).toHaveClass(/off/);
    expect(await coinEl.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe(
      'line-through',
    );
    await shot(page, 'teamstrip-fallen');
    await btn(page, 'Undo').first().click();
    await expect(coin(page, /^D, Dwarf, tap if it fell$/)).toBeEnabled();
    await expect(strip(page).locator('.team-btn')).toHaveText(['D', 'E', 'W']);
  });

  test('the alternate Barbarian and numbered mercenaries get codes, one coin each, in order', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openQuest(page, 1);
    await page.getByRole('button', { name: 'Barbarian (alternate)' }).click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByRole('button', { name: 'Add a mercenary' }).click();
    const merc = page.getByRole('dialog', { name: 'Add a mercenary' });
    const sword = merc.locator('.pick-row').filter({ hasText: 'Swordsman' });
    await sword.getByRole('button', { name: 'Add one Swordsman' }).click();
    await sword.getByRole('button', { name: 'Add one Swordsman' }).click();
    await merc.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Add an ally' }).click();
    const ally = page.getByRole('dialog', { name: 'Add an ally' });
    await ally.getByRole('button', { name: 'Add one Snowdasher' }).click();
    await ally.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Start quest' }).click();
    await dismissStart(page);
    await expect(strip(page).locator('.team-btn')).toHaveText(['Ba', 'E', 'Sw', 'Sw2', 'Sn']);
    await expect(coin(page, /^Sw2, Swordsman 2, tap if it fell$/)).toBeVisible();
    await expect(coin(page, /^Ba, Barbarian \(alternate\), tap if it fell$/)).toBeVisible();
    await expect(strip(page).locator('.hair')).toHaveCount(1); // heroes | mercenaries and allies
    // the ring tells the kind: ink fill for a hero, a ring for the others
    const fill = (name: RegExp) =>
      coin(page, name)
        .locator('.coin')
        .evaluate((e) => {
          const c = getComputedStyle(e);
          return [c.backgroundColor, c.borderTopWidth, c.borderTopStyle];
        });
    expect((await fill(/^Ba,/))[1]).toBe('0px');
    expect(await fill(/^Sw2,/)).toEqual(['rgb(246, 240, 227)', '2px', 'solid']);
    await coin(page, /^Sw2,/).click();
    await expect(page.getByRole('dialog', { name: 'Swordsman 2 fell?' })).toBeVisible();
    await shot(page, 'teamstrip-team');
  });

  test('Frozen Horror quest 0: Snowdasher is an ally coin with its numbers, not a companion', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openQuest(page, 0, 'frozen-horror');
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByRole('button', { name: 'Add an ally' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add an ally' });
    await dialog.getByRole('button', { name: 'Add one Snowdasher' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Start quest' }).click();
    await dismissStart(page);
    await page.getByRole('button', { name: 'Continue' }).click(); // the wolf joins
    await expect(page.locator('.veil')).toHaveCount(0);
    await expect(strip(page).locator('.team-btn')).toHaveText(['E', 'Sn']);
    await expect(strip(page).locator('.coin.npc')).toHaveCount(0);
    await coin(page, /^Sn, Snowdasher/).click();
    const note = page.getByRole('dialog', { name: 'Snowdasher fell?' });
    await expect(note).toContainText('Movement dice 10');
    await expect(note).toContainText('Attack dice 3');
    await expect(note).toContainText('Defend dice 2 · Body 5');
    await shot(page, 'teamstrip-frozen-ally');
    await btn(page, 'Yes, fell').click();
    await expect(coin(page, /^Sn, Snowdasher, fell$/)).toBeDisabled();
    await shot(page, 'teamstrip-frozen-fallen');
  });

  test('a companion has a dashed coin after the hairline; its note has numbers and text, no buttons', async ({
    page,
  }) => {
    await page.goto('/?quest=test&team=dwarf,elf&nosave=1&seed=3&open=d1');
    await openQuestSheet(page);
    await btn(page, 'Call for help').click();
    await btn(page, 'Continue').click();
    const sir = coin(page, /^ST, Sir Test, companion/);
    await expect(strip(page).locator('.team-btn')).toHaveText(['D', 'E', 'ST']);
    await expect(strip(page).locator('.hair')).toHaveCount(1);
    const style = await sir.locator('.coin').evaluate((e) => getComputedStyle(e).borderTopStyle);
    expect(style).toBe('dashed');
    await sir.click();
    const note = page.getByRole('dialog', { name: 'Sir Test' });
    await expect(note).toContainText('Companion');
    await expect(note).toContainText('Defend dice 2');
    await expect(note.getByRole('button', { name: /fell|No/ })).toHaveCount(0);
    await shot(page, 'teamstrip-companion');
  });

  test('accessibility: the strip, an open note and a fallen coin have no axe violations', async ({
    page,
  }) => {
    await play(page);
    const run = async () => {
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      return r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    };
    expect(await run()).toEqual([]);
    await coin(page, /^D, Dwarf/).click();
    expect(await run()).toEqual([]);
    await btn(page, 'Yes, fell').click();
    expect(await run()).toEqual([]);
  });

  test('zoomed in, the board frame stays where it is and the map is clipped inside it', async ({
    page,
  }) => {
    await play(page);
    const frame = () => page.locator('.zoomframe');
    await expect(frame()).toHaveCount(0);
    const before = (await page.locator('.zoomclip').boundingBox())!;
    const boardBefore = (await page.locator('#board').boundingBox())!;
    await shot(page, 'teamstrip-zoom-100');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('150%');
    await expect(frame()).toHaveCount(1);
    const f = (await frame().boundingBox())!;
    // the frame is the fitted board: the same box as the board was at 100% (within the 0.5 px of the stroke)
    expect(Math.abs(f.x - (boardBefore.x + 0.5))).toBeLessThanOrEqual(1);
    expect(Math.abs(f.y - (boardBefore.y + 0.5))).toBeLessThanOrEqual(1);
    expect(Math.abs(f.width - (boardBefore.width - 1))).toBeLessThanOrEqual(1);
    expect(Math.abs(f.height - (boardBefore.height - 1))).toBeLessThanOrEqual(1);
    expect(await page.locator('.zoomclip').boundingBox()).toEqual(before);
    await shot(page, 'teamstrip-zoom-150');
    // pan to the far corner: still inside the frame, the frame does not move
    for (const dir of ['left', 'up']) {
      const b = page.getByRole('button', { name: `Move the map ${dir}` });
      while (await b.isEnabled()) await b.click();
    }
    const f2 = (await frame().boundingBox())!;
    expect(f2).toEqual(f);
    // a note of a coin still opens outside the frame, above the map, whole
    await coin(page, /^D, Dwarf/).click();
    const note = page.getByRole('dialog', { name: 'Dwarf fell?' });
    await expect(note).toBeVisible();
    const n = (await note.boundingBox())!;
    expect(n.y + n.height).toBeLessThan(834);
    await btn(page, 'No').click();
    // back to 100%: the frame drawn by the board itself is the border again
    await page.getByTestId('zoom-level').click();
    await expect(frame()).toHaveCount(0);
  });
});
