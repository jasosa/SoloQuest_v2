import { expect, test } from '@playwright/test';

const PLAY = '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1';

test.describe('themes (decision 78)', () => {
  test('without a theme the board is drawn with the built-in line art', async ({ page }) => {
    await page.goto(PLAY);
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('[data-themed]')).toHaveCount(0);
  });

  test('play: a theme with pictures draws the floor with them', async ({ page }) => {
    await page.goto(`${PLAY}&theme=test`);
    await expect(page.locator('[data-themed="floor"]').first()).toBeVisible();
    expect(await page.locator('[data-themed="floor"]').count()).toBeGreaterThan(10);
    // walls and the opened door use pictures too
    expect(await page.locator('[data-themed="wall"]').count()).toBeGreaterThan(5);
    await expect(page.locator('[data-themed="door"]').first()).toBeAttached();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/theme-play.png' });
  });

  test('without a theme a monster token shows its letter, not a picture', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await page.getByRole('button', { name: 'Make a copy', exact: true }).click();
    await page.getByRole('button', { name: 'Open it', exact: true }).click();
    await expect(page.locator('[data-monster]').first()).toBeVisible();
    await expect(page.locator('[data-token-image]')).toHaveCount(0);
  });

  test('editor: floor and furniture use the theme pictures, rock too', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1&theme=test');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await page.getByRole('button', { name: 'Make a copy', exact: true }).click();
    await page.getByRole('button', { name: 'Open it', exact: true }).click();
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
    // Quest 1 has chests and tables
    expect(await page.locator('[data-themed="furniture"]').count()).toBeGreaterThan(2);
    await expect(page.locator('[data-themed="wall"]').first()).toBeAttached();
    // monsters of Quest 1 get the picture of their type, on the map
    expect(await page.locator('[data-token-image]').count()).toBeGreaterThan(10);
    await page.screenshot({ path: 'test-results/theme-editor.png' });
  });
});
