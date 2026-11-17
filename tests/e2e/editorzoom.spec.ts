import { expect, test, type Page } from '@playwright/test';

const board = (page: Page) => page.locator('#editor-board');
async function pointAt(page: Page, x: number, y: number) {
  const box = (await board(page).boundingBox())!;
  const k = box.width / (26 * 34 + 4);
  return { x: box.x + ((x + 0.5) * 34 + 2) * k, y: box.y + ((y + 0.5) * 34 + 2) * k };
}

test.describe('editor map zoom', () => {
  test('the chips zoom the editor board, a click still lands on its square, the wheel moves it', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('Zoom quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    const before = (await board(page).boundingBox())!;
    const level = page.getByTestId('zoom-level');
    await expect(level).toHaveText('100%');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(level).toHaveText('200%');
    const after = (await board(page).boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width * 1.9);

    // a monster placed on a square of the zoomed board lands on that square
    await page.locator('.ed-tools').getByRole('button', { name: 'Monsters', exact: true }).click();
    const centre = await page.locator('.ed-zoom').boundingBox();
    // pick the square under the middle of the visible area
    const cx = centre!.x + centre!.width / 2;
    const cy = centre!.y + centre!.height / 2;
    const k = after.width / (26 * 34 + 4);
    const sx = Math.floor(((cx - after.x) / k - 2) / 34);
    const sy = Math.floor(((cy - after.y) / k - 2) / 34);
    const target = await pointAt(page, sx, sy);
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('[data-monster="m1"]')).toHaveCount(1);

    // the wheel (no Ctrl) moves a zoomed board
    const moved = (await board(page).boundingBox())!;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await board(page).boundingBox())!.y).toBeLessThan(moved.y);

    // back to the fitted size
    await level.click();
    await expect(level).toHaveText('100%');
  });
});
