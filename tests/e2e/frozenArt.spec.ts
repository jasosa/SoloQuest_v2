import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { dismissStart, openSettings } from './helpers';

// Texture pack families (decision 99). A core pack dresses every quest. An expansion pack is made for
// one core pack and dresses only the quests of its box; the Frozen Horror pack ships with the app and
// is made for the core pack "core-ah-2021", which the player imports. Nothing is used by itself.
const FH0 = '/?quest=fh00-into-the-northlands&team=dwarf&seed=1&open=in,d1,look@9:9,d2,d3';
const FH_TUNNEL = `${FH0},d4,d5,d6,d7`;
const CORE_QUEST = '/?quest=1&team=dwarf&seed=1&open=d1';
const FH = '[data-pack="fz-ah-2021"]';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** A pack file: a theme.json and one picture, `floor.png`. */
function packFile(manifest: Record<string, unknown>) {
  const buffer = Buffer.from(
    zipSync({
      'theme.json': strToU8(
        JSON.stringify({ format: 'sqtextures', version: 1, floor: ['floor.png'], ...manifest }),
      ),
      'floor.png': new Uint8Array(PNG),
    }),
  );
  return { name: `${manifest['id']}.sqtextures`, mimeType: 'application/zip', buffer };
}
const CORE = packFile({ id: 'core-ah-2021', name: 'Test core pack', family: 'ah-2021' });
const OTHER_CORE = packFile({ id: 'other-core', name: 'Other core pack', family: 'other-family' });
const OTHER_FAMILY_FH = packFile({
  id: 'fh-for-other',
  name: 'Frozen Horror for the other core',
  box: 'frozen-horror',
  extends: 'other-core',
  family: 'other-family',
});

async function openTextures(page: Page) {
  await page.goto('/');
  await openSettings(page);
  await page.getByRole('button', { name: /^Textures/ }).click();
  return page.getByRole('dialog', { name: 'Texture packs' });
}
const importFile = (dlg: ReturnType<Page['getByRole']>, f: ReturnType<typeof packFile>) =>
  dlg.getByLabel('Texture pack file').setInputFiles(f);
const applyIt = (dlg: ReturnType<Page['getByRole']>, sel: string) =>
  dlg.locator(sel).getByRole('button', { name: 'Use', exact: true }).click();

/** Import the core pack, use it, then use the Frozen Horror pack with it. */
async function useBoth(page: Page) {
  const dlg = await openTextures(page);
  await importFile(dlg, CORE);
  await applyIt(dlg, '[data-pack="core-ah-2021"]');
  await applyIt(dlg, FH);
  await expect(dlg.getByTestId('applied')).toHaveText(
    'Core: Test core pack · Expansions: Frozen Horror',
  );
  return dlg;
}

test.describe('texture pack families (decision 99)', () => {
  test('by default every quest, Frozen Horror included, uses the built-in drawn look', async ({
    page,
  }) => {
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-room-tile="cageRoom"]')).toHaveCount(1);
    await expect(page.locator('[data-themed]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/fh-pack-off.png' });
  });

  test('the dialog lists the Frozen Horror pack as an expansion pack that needs its core pack', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    const row = dlg.locator(FH);
    await expect(row.getByText('Frozen Horror', { exact: true })).toBeVisible();
    await expect(row).toContainText('Frozen Horror pack');
    await expect(row).toContainText('Official');
    await expect(row).toContainText('Included with the app');
    await expect(row).toContainText(/\d(\.\d)? MB/);
    await expect(row.getByText('In use')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    // its core pack is not installed: it says so, and Use is disabled
    await expect(dlg.getByTestId('needs-fz-ah-2021')).toHaveText(
      'Needs the pack core-ah-2021. Import it first.',
    );
    await expect(row.getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    await expect(dlg.getByTestId('applied')).toHaveText('Built-in look: no pack in use.');
    await page.screenshot({ path: 'test-results/fh-pack-dialog.png' });
  });

  test('with the core pack installed but not in use, it says to apply the core pack first', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await importFile(dlg, CORE);
    await expect(dlg.getByTestId('needs-fz-ah-2021')).toHaveText(
      'Needs the pack Test core pack. Apply it first.',
    );
    await expect(dlg.locator(FH).getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    // the expansion pack is listed under its core pack
    await expect(dlg.locator('[data-pack="core-ah-2021"] + [data-pack]')).toHaveAttribute(
      'data-pack',
      'fz-ah-2021',
    );
  });

  test('a pack made for another core pack is refused: it needs that core pack', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await importFile(dlg, CORE);
    await importFile(dlg, OTHER_CORE);
    await importFile(dlg, OTHER_FAMILY_FH);
    await applyIt(dlg, '[data-pack="core-ah-2021"]');
    const row = dlg.locator('[data-pack="fh-for-other"]');
    await expect(dlg.getByTestId('needs-fh-for-other')).toHaveText(
      'Needs the pack Other core pack. Apply it first.',
    );
    await expect(row.getByRole('button', { name: 'Use', exact: true })).toBeDisabled();
    await expect(dlg.getByTestId('applied')).toHaveText('Core: Test core pack');
  });

  test('a pack file that is an expansion pack with no core pack is refused with a sentence', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await importFile(
      dlg,
      packFile({ id: 'lonely', name: 'Lonely', box: 'frozen-horror', family: 'ah-2021' }),
    );
    await expect(dlg.getByRole('alert')).toContainText(
      'An expansion pack needs the core pack it is made for',
    );
    await expect(dlg.locator('[data-pack="lonely"]')).toHaveCount(0);
    await importFile(dlg, packFile({ id: 'bossy', name: 'Bossy', extends: 'core-ah-2021' }));
    await expect(dlg.getByRole('alert')).toContainText('A core pack cannot extend another pack');
  });

  test('the core pack and the Frozen Horror pack together: core pictures everywhere, Frozen Horror pictures in Frozen Horror quests only', async ({
    page,
  }) => {
    await useBoth(page);
    await page.screenshot({ path: 'test-results/fh-pack-both-dialog.png' });
    // a Frozen Horror quest: the core floor and the Frozen Horror door and tiles
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
    await expect(
      page.locator('[data-edge-door="ironEntry"] image[data-themed="edge-door"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-board-tile="iceCaveEntrance"] image[data-tile-picture]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-room-tile="cageRoom"] image[data-tile-picture="cageRoom"]'),
    ).toHaveCount(1);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/fh-pack-on.png' });
    // a core quest: the core floor, and nothing of Frozen Horror
    await page.goto(CORE_QUEST);
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
    await expect(
      page.locator(
        '[data-themed="tile"], [data-themed="edge-door"], [data-themed="tunnel"], [data-themed="token"]',
      ),
    ).toHaveCount(0);
  });

  test('ice tunnels use the picture of their design', async ({ page }) => {
    await useBoth(page);
    await page.goto(FH_TUNNEL);
    await dismissStart(page);
    await expect(page.locator('[data-tunnel="tun3:b"] image[data-themed="tunnel"]')).toHaveCount(1);
  });

  test('stopping the core pack stops the Frozen Horror pack with it, and the drawn look is back', async ({
    page,
  }) => {
    const dlg = await useBoth(page);
    await dlg
      .locator('[data-pack="core-ah-2021"]')
      .getByRole('button', { name: 'Stop using it' })
      .click();
    await expect(dlg.getByRole('status')).toContainText('Frozen Horror');
    await expect(dlg.getByTestId('applied')).toHaveText('Built-in look: no pack in use.');
    await expect(dlg.getByText('In use', { exact: true })).toHaveCount(1); // only the Classic row
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-themed]')).toHaveCount(0);
  });

  test('stopping only the Frozen Horror pack leaves the core pack', async ({ page }) => {
    const dlg = await useBoth(page);
    await dlg.locator(FH).getByRole('button', { name: 'Stop using it' }).click();
    await expect(dlg.getByTestId('applied')).toHaveText('Core: Test core pack');
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
    await expect(page.locator('[data-themed="edge-door"]')).toHaveCount(0);
  });

  test('both packs stay in use after a reload', async ({ page }) => {
    await useBoth(page);
    await page.goto(FH0);
    await dismissStart(page);
    // wait until the board is dressed (the pictures are read from the app) before leaving the page
    await expect(page.locator('[data-themed="edge-door"]')).toHaveCount(1);
    await page.reload();
    await dismissStart(page);
    await expect(page.locator('[data-themed="edge-door"]')).toHaveCount(1);
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
  });

  test('the Frozen Horror pack can be exported as a .sqtextures file with its core pack named', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    const download = page.waitForEvent('download');
    await dlg.locator(FH).getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('fz-ah-2021.sqtextures');
    expect(statSync(await file.path()).size).toBeGreaterThan(1_000_000);
  });

  test('pack cards: a short kicker, the name on one line, the details under it, buttons in their own row', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await importFile(
      dlg,
      packFile({
        id: 'core-ah-2021',
        name: 'core-ah-2021',
        family: 'ah-2021',
        author: "The owner's own pictures, not for sharing",
      }),
    );
    await applyIt(dlg, '[data-pack="core-ah-2021"]');
    await applyIt(dlg, FH);
    const core = dlg.locator('[data-pack="core-ah-2021"]');
    await expect(core.locator('.fr-qnum')).toHaveText('Core pack');
    await expect(core.locator('.pk-meta')).toContainText('Fan-made · Family ah-2021 · The owner');
    await expect(dlg.locator(`${FH} .fr-qnum`)).toHaveText('Frozen Horror pack');
    await expect(dlg.locator(`${FH} .pk-meta`)).toContainText('Included with the app');
    // the name is on one line, and the buttons are under the text, not beside it
    const title = await core.locator('.fr-qtitle').boundingBox();
    const actions = await core.locator('.pk-actions').boundingBox();
    expect(title!.height).toBeLessThan(30);
    expect(actions!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    await dlg.screenshot({ path: 'test-results/textures-dialog-cards.png' });
    await page.setViewportSize({ width: 700, height: 834 });
    await expect(core.locator('.fr-qtitle')).toBeVisible();
    await dlg.screenshot({ path: 'test-results/textures-dialog-cards-narrow.png' });
  });

  test('Preview of the Frozen Horror pack shows its own slots and lists only what is missing', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await dlg.getByTestId('preview-fz-ah-2021').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Frozen Horror' });
    const sample = prev.getByTestId('pack-sample');
    await expect(sample).toBeVisible();
    await expect(sample.locator('[data-slot^="enemy."]')).toHaveCount(8);
    await expect(
      sample.locator('[data-slot^="edgeDoor."] image[data-themed="edge-door"]'),
    ).toHaveCount(2);
    await expect(sample.locator('[data-slot^="tunnel."] image[data-themed="tunnel"]')).toHaveCount(
      3,
    );
    await expect(sample.locator('image[data-themed="tile"]')).toHaveCount(18);
    // only what the pack should cover and does not: no core slot
    const missing = prev.getByTestId('pack-missing');
    await expect(missing).toContainText('tunnel design 4');
    await expect(missing).not.toContainText('monster');
    await expect(missing).not.toContainText('furniture');
    await expect(missing).not.toContainText('board picture');
    // adjust an enemy picture
    await sample.locator('[data-slot="enemy.yeti"]').click();
    await expect(prev.getByLabel('Picture to adjust')).toHaveValue('enemy.yeti');
    await prev.getByRole('button', { name: 'Size: more' }).click();
    await expect(prev.getByText('Unsaved changes')).toBeVisible();
  });

  test('Preview: tile pictures are in the Adjust list, a tap on a tile picks its row', async ({
    page,
  }) => {
    const dlg = await openTextures(page);
    await dlg.getByTestId('preview-fz-ah-2021').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Frozen Horror' });
    const sample = prev.getByTestId('pack-sample');
    const list = prev.getByLabel('Picture to adjust');
    await expect(list.locator('optgroup[label="Tiles"] option')).toHaveCount(18);
    await expect(list.locator('option[value="tile.iceVault.2x3"]')).toHaveText('Ice vault 2x3');
    await expect(list.locator('option[value="tile.scepterRoom"]')).toHaveText('Scepter room');
    await sample.locator('[data-slot="tile.iceVault.3x4"]').click();
    await expect(list).toHaveValue('tile.iceVault.3x4');
    await prev.getByRole('button', { name: 'Size: more' }).click();
    await expect(prev.getByText('Unsaved changes')).toBeVisible();
    await prev.screenshot({ path: 'test-results/pack-adjust-tiles.png' });
  });

  test('Preview check warns about small enemy, edge door and tunnel pictures', async ({ page }) => {
    const dlg = await openTextures(page);
    await importFile(dlg, CORE);
    await importFile(
      dlg,
      packFile({
        id: 'tiny-fh',
        name: 'Tiny Frozen Horror',
        box: 'frozen-horror',
        extends: 'core-ah-2021',
        family: 'ah-2021',
        enemy: { yeti: 'floor.png' },
        edgeDoor: { ironEntry: 'floor.png' },
        tunnel: { '1': 'floor.png' },
        tile: { scepterRoom: { file: 'floor.png', cells: [4, 4] } },
      }),
    );
    await dlg.getByTestId('preview-tiny-fh').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Tiny Frozen Horror' });
    const warnings = prev.locator('.pv-warnings li');
    await expect(warnings).toHaveCount(4);
    await expect(warnings.nth(0)).toContainText('enemy yeti: 1 x 1 px');
    await expect(warnings.nth(1)).toContainText('edge door ironEntry: 1 x 1 px');
    await expect(warnings.nth(2)).toContainText('tunnel design 1: 1 x 1 px');
    await expect(warnings.nth(3)).toContainText('tile scepterRoom 4x4: 1 x 1 px');
    await prev.screenshot({ path: 'test-results/pack-check-warnings.png' });
  });

  test('editor: tokens, tiles and doors are pictures once both are used, and Textures off draws the built-in look', async ({
    page,
  }) => {
    await useBoth(page);
    await page.goto('/?editor=1');
    await page.getByRole('button', { name: /^Open quest/ }).click();
    const sel = page.getByLabel('Bundled quest');
    const label = await sel
      .locator('option')
      .filter({ hasText: /Deadly Depths/ })
      .first()
      .innerText();
    await sel.selectOption({ label });
    await page.getByRole('button', { name: 'Make a copy', exact: true }).click();
    await page.getByRole('button', { name: 'Open it', exact: true }).click();
    await expect(page.locator('image[data-themed="token"]').first()).toBeAttached();
    await expect(
      page.locator('[data-room-tile="frozenCrypt"] image[data-tile-picture]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-edge-door] image[data-themed="edge-door"]').first(),
    ).toBeAttached();
    await page.getByRole('button', { name: /^Textures: on/ }).click();
    await expect(page.locator('image[data-themed]')).toHaveCount(0);
  });

  // An edge door: the door on the wall line, its arrow outside the board and pointing out, nothing clipped.
  /** The door picture (and the arrow half of the entry) must lie inside the map area. */
  async function expectInsideMap(page: Page, doorSel: string, clipSel: string) {
    const clip = (await page.locator(clipSel).boundingBox())!;
    for (const i of await page
      .locator(doorSel)
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(i.x).toBeGreaterThanOrEqual(clip.x - 0.5);
      expect(i.y).toBeGreaterThanOrEqual(clip.y - 0.5);
      expect(i.right).toBeLessThanOrEqual(clip.x + clip.width + 0.5);
      expect(i.bottom).toBeLessThanOrEqual(clip.y + clip.height + 0.5);
    }
  }
  /** The picture straddles the wall: its arrow half is outside the board, its door half inside. */
  function expectStraddles(
    i: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    side: 'w' | 'e' | 'n' | 's',
  ) {
    const tol = 6;
    if (side === 'w') {
      expect(i.x).toBeLessThan(b.x - tol);
      expect(i.x + i.width).toBeGreaterThan(b.x + tol);
    } else if (side === 'e') {
      expect(i.x + i.width).toBeGreaterThan(b.x + b.width + tol);
      expect(i.x).toBeLessThan(b.x + b.width - tol);
    } else if (side === 'n') {
      expect(i.y).toBeLessThan(b.y - tol);
      expect(i.y + i.height).toBeGreaterThan(b.y + tol);
    } else {
      expect(i.y + i.height).toBeGreaterThan(b.y + b.height + tol);
      expect(i.y).toBeLessThan(b.y + b.height - tol);
    }
  }
  for (const [quest, side] of [
    ['fh01-xanon-pass', 'w'],
    ['fh06-the-frosted-path', 'e'],
  ] as const)
    test(`play: the entry door of ${quest} on the ${side} border is whole, on the wall, with its arrow outside`, async ({
      page,
    }) => {
      await useBoth(page);
      await page.goto(`/?quest=${quest}&team=dwarf&seed=1&open=in`);
      await dismissStart(page);
      const door = '[data-edge-door="ironEntry"] image[data-themed="edge-door"]';
      await expect(page.locator(door)).toHaveCount(1);
      const i = (await page.locator(door).boundingBox())!;
      const b = (await page.locator('#board').boundingBox())!;
      expectStraddles(i, b, side);
      await expectInsideMap(page, '[data-edge-door] image[data-themed="edge-door"]', '.zoomclip');
      await page.waitForTimeout(900);
      await page.screenshot({ path: `test-results/edge-door-play-${side}.png` });
    });

  test('editor: entry and exit doors on all four borders are whole, on the wall, and clicks still land on the right squares', async ({
    page,
  }) => {
    await useBoth(page);
    await page.goto('/?editor=1');
    await page.getByRole('button', { name: /^New quest/ }).click();
    await page.getByLabel('Title').first().fill('Edge doors');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    const tool = (name: string) =>
      page
        .locator('.ed-tools, .ed-palette, [data-testid="tool-options"]')
        .getByRole('button', { name: new RegExp(String.raw`^${name}( \d+ of \d+)?$`) });
    const svg = page.locator('#editor-board');
    const pointAt = async (x: number, y: number, fx = 0.5, fy = 0.5) => {
      const box = (await svg.boundingBox())!;
      const k = box.width / (26 * 34 + 4);
      return { x: box.x + ((x + fx) * 34 + 2) * k, y: box.y + ((y + fy) * 34 + 2) * k };
    };
    await tool('Doors').click();
    const place = async (kind: string, x: number, y: number, fx: number, fy: number) => {
      await tool(kind).click();
      const p = await pointAt(x, y, fx, fy);
      await page.mouse.click(p.x, p.y);
    };
    await place('Iron entry', 0, 9, 0.06, 0.5); // west
    await place('Wooden exit', 25, 5, 0.94, 0.5); // east
    await place('Wooden exit', 12, 0, 0.5, 0.06); // north
    await place('Wooden exit', 12, 18, 0.5, 0.94); // south
    const doors = page.locator('[data-edge-door] image[data-themed="edge-door"]');
    await expect(doors).toHaveCount(4);
    const b = (await svg.boundingBox())!;
    const sides = ['ironEntry', 'woodenExit'] as const;
    expect(sides.length).toBe(2);
    const at = async (kind: string, nth: number) =>
      (await page
        .locator(`[data-edge-kind="${kind}"] image[data-themed="edge-door"]`)
        .nth(nth)
        .boundingBox())!;
    expectStraddles(await at('ironEntry', 0), b, 'w');
    expectStraddles(await at('woodenExit', 0), b, 'e');
    expectStraddles(await at('woodenExit', 1), b, 'n');
    expectStraddles(await at('woodenExit', 2), b, 's');
    await expectInsideMap(page, '[data-edge-door] image[data-themed="edge-door"]', '.ed-zoom');
    // the doors sit on the squares that were clicked (the room around the board did not move the squares)
    const west = await at('ironEntry', 0);
    const wp = await pointAt(0, 9, 0, 0.5);
    expect(Math.abs(west.y + west.height / 2 - wp.y)).toBeLessThan(3);
    const north = await at('woodenExit', 1);
    const np = await pointAt(12, 0, 0.5, 0);
    expect(Math.abs(north.x + north.width / 2 - np.x)).toBeLessThan(3);
    // an interior click still reports the interior (hit testing is unchanged by the room)
    await tool('Iron entry').click();
    const mid = await pointAt(5, 5);
    await page.mouse.click(mid.x, mid.y);
    await expect(page.locator('.toast')).toContainText('outer edge');
    await page.screenshot({ path: 'test-results/edge-door-editor.png' });
  });

  test('an edge door in the wall of a rock area is drawn above the tile picture', async ({
    page,
  }) => {
    await useBoth(page);
    await page.goto(FH0);
    await dismissStart(page);
    const above = await page.evaluate(() => {
      const tile = document.querySelector('[data-board-tile="iceCaveEntrance"]')!;
      const door = document.querySelector('[data-edge-door="ironEntry"]')!;
      return !!(tile.compareDocumentPosition(door) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(above).toBe(true);
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'test-results/edge-door-rock.png' });
  });

  // The owner's own core pack (git-ignored, never in the repo): a manual check against the real file,
  // skipped where `reference/` is absent (CI).
  const REAL = [
    resolve('reference/texture-pack/core-ah-2021.sqtextures'),
    resolve('../../../reference/texture-pack/core-ah-2021.sqtextures'),
  ].find((f) => existsSync(f));
  test('the owner core pack (core-ah-2021) and the Frozen Horror pack work together', async ({
    page,
  }) => {
    test.skip(!REAL, 'reference/texture-pack/core-ah-2021.sqtextures is not here (git-ignored)'); // verify-ok: the owner's local core pack is git-ignored and absent in CI
    const dlg = await openTextures(page);
    await importFile(dlg, {
      name: 'core-ah-2021.sqtextures',
      mimeType: 'application/zip',
      buffer: readFileSync(REAL!),
    });
    await expect(dlg.getByTestId('needs-fz-ah-2021')).toHaveText(
      'Needs the pack core-ah-2021. Apply it first.',
    );
    await applyIt(dlg, '[data-pack="core-ah-2021"]');
    await applyIt(dlg, FH);
    await expect(dlg.getByTestId('applied')).toHaveText(
      'Core: core-ah-2021 · Expansions: Frozen Horror',
    );
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-themed="board"]').first()).toBeAttached();
    await expect(page.locator('[data-themed="edge-door"]')).toHaveCount(1);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/fh-pack-real-core.png' });
  });
});
