import { statSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dismissStart, openSettings } from './helpers';

// The Frozen Horror pictures are a texture pack that ships with the app (decision 98). Nothing is applied
// by itself: the player picks it in the Textures dialog.
const FH0 = '/?quest=fh00-into-the-northlands&team=dwarf&seed=1&open=in,d1,look@9:9,d2,d3';
const FH_TUNNEL = `${FH0},d4,d5,d6,d7`;
const PACK = '[data-pack="frozen-horror-art"]';

async function openTextures(page: Page) {
  await page.goto('/');
  await openSettings(page);
  await page.getByRole('button', { name: /^Textures/ }).click();
}

/** The player applies the pack (the choice is kept on the device, so a reload keeps it). */
async function usePack(page: Page) {
  await openTextures(page);
  await page.locator(PACK).getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.locator(PACK).getByText('In use')).toBeVisible();
}

test.describe('Frozen Horror pack (explicit, decision 98)', () => {
  test('by default a Frozen Horror quest uses the built-in drawn look', async ({ page }) => {
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-room-tile="cageRoom"]')).toHaveCount(1);
    await expect(page.locator('[data-themed]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/fh-pack-off.png' });
  });

  test('the Textures dialog lists it with its name, box and size, not applied', async ({
    page,
  }) => {
    await openTextures(page);
    const row = page.locator(PACK);
    await expect(row.getByText('Frozen Horror', { exact: true })).toBeVisible();
    await expect(row).toContainText('For frozen-horror');
    await expect(row).toContainText('Official');
    await expect(row).toContainText('Included with the app');
    await expect(row).toContainText(/\d(\.\d)? MB/);
    await expect(row.getByText('In use')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/fh-pack-dialog.png' });
  });

  test('using it draws the pictures; stopping it brings the drawn look back', async ({ page }) => {
    await usePack(page);
    await page.goto(FH0);
    await dismissStart(page);
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

    await openTextures(page);
    await page.locator(PACK).getByRole('button', { name: 'Stop using it' }).click();
    await expect(page.locator(PACK).getByText('In use')).toHaveCount(0);
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-themed]')).toHaveCount(0);
  });

  test('ice tunnels use the picture of their design', async ({ page }) => {
    await usePack(page);
    await page.goto(FH_TUNNEL);
    await dismissStart(page);
    await expect(page.locator('[data-tunnel="tun3:b"] image[data-themed="tunnel"]')).toHaveCount(1);
  });

  test('a core quest is not dressed by a pack made for Frozen Horror', async ({ page }) => {
    await usePack(page);
    await page.goto('/?quest=1&team=dwarf&seed=1&open=d1');
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('[data-themed]')).toHaveCount(0);
  });

  test('it can be exported as a .sqtextures file', async ({ page }) => {
    await openTextures(page);
    const download = page.waitForEvent('download');
    await page.locator(PACK).getByRole('button', { name: 'Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('frozen-horror-art.sqtextures');
    const path = await file.path();
    expect(statSync(path).size).toBeGreaterThan(1_000_000);
  });

  test('editor: tokens, tiles and doors are pictures once it is used, and Textures off draws the built-in look', async ({
    page,
  }) => {
    await usePack(page);
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
});
