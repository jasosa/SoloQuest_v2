import { expect, test, type Page } from '@playwright/test';
import { gotoQuest } from './helpers';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('furniture names', () => {
  test('hover shows the name, and so does keyboard focus', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    const stairs = page.locator('[data-furniture="f-stairs"]');
    await expect(stairs).toHaveCount(1);
    await expect(page.locator('[data-furniture-label]')).toHaveCount(0);
    await stairs.hover();
    await expect(page.locator('[data-furniture-label="f-stairs"]')).toContainText('Stairway');
    await shot(page, 'furniture-hover');
    await page.mouse.move(600, 300);
    await expect(page.locator('[data-furniture-label]')).toHaveCount(0);
    await stairs.focus();
    await expect(page.locator('[data-furniture-label="f-stairs"]')).toContainText('Stairway');
  });

  test('a tap on furniture opens the room note headed by its name', async ({ page }) => {
    await gotoQuest(page, '/?quest=1&team=dwarf&nosave=1&seed=1');
    const stairs = page.locator('[data-furniture="f-stairs"]');
    const box = await stairs.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await stairs.click();
    const note = page.getByRole('dialog');
    await expect(note).toContainText('Stairway');
    await expect(note).toContainText('Search this room');
    await expect(btn(page, 'Search for treasure')).toBeVisible();
    await shot(page, 'furniture-note');
  });

  test('a chest shows its name and still opens the chest note; doors stay tappable', async ({
    page,
  }) => {
    await page.goto('/?quest=test&team=dwarf&nosave=1&seed=1&open=d1,d2');
    await page.waitForTimeout(900);
    const chest = page.locator('[data-chest="f1"]');
    await chest.hover();
    await expect(page.locator('[data-furniture-label="f1"]')).toContainText('Chest');
    await chest.click();
    await expect(page.getByRole('dialog')).toContainText('Look for traps');
    await page.keyboard.press('Escape');
    await page.locator('[data-door="d3"]').click();
    await expect(page.getByRole('dialog')).toContainText('Open this door?');
  });
});
