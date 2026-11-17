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

  test('zoomed in all the way, the whole board can be reached, also its lower edge', async ({
    page,
  }) => {
    await page.goto(board);
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('300%');
    const fire = (type: string, x: number, y: number) =>
      page.evaluate(
        ([t, px, py]) => {
          document.querySelector('.map.zoombox')!.dispatchEvent(
            new PointerEvent(t as string, {
              pointerId: 1,
              pointerType: 'touch',
              clientX: px as number,
              clientY: py as number,
              bubbles: true,
            }),
          );
        },
        [type, x, y] as const,
      );
    const clip = (await page.locator('.zoomclip').boundingBox())!;
    // drag the board up (and left) a lot: the end of the board must come into view
    await fire('pointerdown', clip.x + 400, clip.y + clip.height - 20);
    for (let i = 1; i <= 100; i++)
      await fire('pointermove', clip.x + 400 - i * 30, clip.y + clip.height - 20 - i * 30);
    await fire('pointerup', clip.x, clip.y);
    const drawn = (await page.locator('#board').boundingBox())!;
    expect(drawn.y + drawn.height).toBeLessThanOrEqual(clip.y + clip.height + 1);
    expect(drawn.x + drawn.width).toBeLessThanOrEqual(clip.x + clip.width + 1);
  });

  test('after zooming in, fingers zoom out and move the board, and a lifted finger lets go of it', async ({
    page,
  }) => {
    await page.goto(board);
    const fire = (type: string, id: number, x: number, y: number, kind = 'touch') =>
      page.evaluate(
        ([t, i, px, py, pt]) => {
          document.querySelector('.map.zoombox')!.dispatchEvent(
            new PointerEvent(t as string, {
              pointerId: i as number,
              pointerType: pt as string,
              clientX: px as number,
              clientY: py as number,
              bubbles: true,
            }),
          );
        },
        [type, id, x, y, kind] as const,
      );
    const map = (await page.locator('.map.zoombox').boundingBox())!;
    const cx = map.x + map.width / 2;
    const cy = map.y + map.height / 2;
    const level = page.getByTestId('zoom-level');
    const pinch = async (from: number, to: number) => {
      await fire('pointerdown', 1, cx - from, cy);
      await fire('pointerdown', 2, cx + from, cy);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const d = from + ((to - from) * i) / steps;
        await fire('pointermove', 1, cx - d, cy);
        await fire('pointermove', 2, cx + d, cy);
      }
      await fire('pointerup', 1, cx - to, cy);
      await fire('pointerup', 2, cx + to, cy);
    };
    await pinch(40, 160); // zoom in with two fingers
    const zoomedIn = parseInt(await level.innerText());
    expect(zoomedIn).toBeGreaterThan(150);
    await pinch(160, 40); // and out again with two fingers
    expect(parseInt(await level.innerText())).toBeLessThan(zoomedIn);

    // zoom in with the chips, then one finger drags the board, and lifting it ends the drag
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    const start = (await page.locator('#board').boundingBox())!;
    await fire('pointerdown', 7, cx, cy, 'mouse');
    for (let i = 1; i <= 6; i++) await fire('pointermove', 7, cx - i * 30, cy, 'mouse');
    await fire('pointerup', 7, cx - 180, cy, 'mouse');
    const dragged = (await page.locator('#board').boundingBox())!;
    expect(dragged.x).toBeLessThan(start.x - 100);
    // the mouse moves on without a button: the board stays where it is
    await fire('pointermove', 7, cx - 400, cy, 'mouse');
    const after = (await page.locator('#board').boundingBox())!;
    expect(after.x).toBeCloseTo(dragged.x, 0);
  });
});
