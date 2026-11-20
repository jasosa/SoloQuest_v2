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
    await expect(row).toContainText('For frozen-horror');
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

  test('editor: tokens, tiles and doors are pictures once both are used, and Textures off draws the built-in look', async ({
    page,
  }) => {
    await useBoth(page);
    await page.goto('/?editor=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
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
