import { expect, test, type Page } from '@playwright/test';
import { dismissStart, openSettings } from './helpers';

// Frozen Horror pictures (decision 96): the built-in art layer of the Frozen Horror box.
const OPEN = 'in,d1,look@9:9,d2,d3';
const FH0 = `/?quest=0&team=dwarf&nosave=1&seed=1&open=${OPEN}`;

const switchOff = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem('soloquest-box-art-off', JSON.stringify(['frozen-horror'])),
  );

test.describe('Frozen Horror art layer', () => {
  test('on by default: the entrance tile, the iron door and a room tile are pictures', async ({
    page,
  }) => {
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
    await page.screenshot({ path: 'test-results/fh-art-on.png' });
  });

  test('ice tunnels use the picture of their design', async ({ page }) => {
    await page.goto('/?quest=0&team=dwarf&nosave=1&seed=1&open=in,d1,look@9:9,d2,d3,d4,d5,d6,d7');
    await dismissStart(page);
    await expect(page.locator('[data-tunnel="tun3:b"] image[data-themed="tunnel"]')).toHaveCount(1);
  });

  test('switched off: the drawn look, no pictures', async ({ page }) => {
    await switchOff(page);
    await page.goto(FH0);
    await dismissStart(page);
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-room-tile="cageRoom"]')).toHaveCount(1);
    await expect(page.locator('[data-themed]')).toHaveCount(0);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/fh-art-off.png' });
  });

  test('a core quest never gets the layer', async ({ page }) => {
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('[data-themed]')).toHaveCount(0);
  });

  test('the Textures dialog has a switch for it, kept on this device', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByRole('button', { name: /^Textures/ }).click();
    const sw = page.getByRole('switch', { name: 'Frozen Horror pictures' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => localStorage.getItem('soloquest-box-art-off'))).toContain(
      'frozen-horror',
    );
    await page.screenshot({ path: 'test-results/fh-art-dialog.png' });
    await sw.click();
    expect(await page.evaluate(() => localStorage.getItem('soloquest-box-art-off'))).toBeNull();
  });

  test('editor: monster tokens, tiles and doors are pictures, and Textures off draws the built-in look', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
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
    await expect(page.locator('[data-tunnel] image[data-themed="tunnel"]').first()).toBeAttached();
    await page.getByRole('button', { name: /^Textures: on/ }).click();
    await expect(page.locator('image[data-themed]')).toHaveCount(0);
  });
});
