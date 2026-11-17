import { expect, test } from '@playwright/test';

const board = '/?quest=1&team=dwarf&nosave=1&seed=1&open=d1';

test.describe('board zoom', () => {
  test('the buttons zoom in and out in 25% steps and reset to 100%', async ({ page }) => {
    await page.goto(board);
    const level = page.getByTestId('zoom-level');
    await expect(level).toHaveText('100%');
    await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(level).toHaveText('150%');
    const small = (await page.locator('#board').boundingBox())!;
    expect(small.width).toBeGreaterThan(1000); // the board is larger on screen
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(level).toHaveText('125%');
    await level.click();
    await expect(level).toHaveText('100%');
  });

  test('a tap on the zoomed board still opens its note, which stays next to what it points at', async ({
    page,
  }) => {
    await page.goto(board);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const map = (await page.locator('.map.zoombox').boundingBox())!;
    const before = await page.getByRole('dialog').count();
    // tap a room of the zoomed board (it may be scrolled out of sight, so the click is sent to it)
    await page
      .locator('[aria-label^="Room "]')
      .first()
      .evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await expect(page.getByRole('dialog')).toHaveCount(before + 1);
    const n = (await page.getByRole('dialog').last().boundingBox())!;
    // the note stays on the map, wherever the room went
    expect(n.x).toBeGreaterThanOrEqual(map.x - 1);
    expect(n.x + n.width).toBeLessThanOrEqual(map.x + map.width + 1);
    expect(n.y).toBeGreaterThanOrEqual(map.y - 1);
  });

  test('two fingers zoom the board, and a drag does not tap', async ({ page }) => {
    await page.goto(board);
    const dialogsBefore = await page.getByRole('dialog').count();
    const fire = (type: string, id: number, x: number, y: number) =>
      page.evaluate(
        ([t, i, px, py]) => {
          const el = document.querySelector('.map.zoombox')!;
          el.dispatchEvent(
            new PointerEvent(t as string, {
              pointerId: i as number,
              pointerType: 'touch',
              clientX: px as number,
              clientY: py as number,
              bubbles: true,
            }),
          );
        },
        [type, id, x, y] as const,
      );
    const box = (await page.locator('.map.zoombox').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await fire('pointerdown', 1, cx - 50, cy);
    await fire('pointerdown', 2, cx + 50, cy);
    for (let i = 1; i <= 6; i++) {
      await fire('pointermove', 1, cx - 50 - i * 20, cy);
      await fire('pointermove', 2, cx + 50 + i * 20, cy);
    }
    await fire('pointerup', 1, cx - 170, cy);
    await fire('pointerup', 2, cx + 170, cy);
    expect(parseInt(await page.getByTestId('zoom-level').innerText())).toBeGreaterThan(100);
    await expect(page.getByRole('dialog')).toHaveCount(dialogsBefore);
  });
});
