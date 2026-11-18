import { expect, test } from '@playwright/test';

test.describe('fit to the screen', () => {
  test('on a window shorter than the design, the Start button is on screen without scrolling and the screen is not shrunk', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1194, height: 640 });
    await page.goto('/?nosave=1');
    // quest select fills the width and does not shrink: it is readable on a short window
    expect(Number(await page.locator('[data-fit-scale]').getAttribute('data-fit-scale'))).toBe(1);
    const newGameButton = page.getByTestId('new-game');
    await expect(newGameButton).toBeVisible();
    const box = (await newGameButton.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    expect(box.x + box.width).toBeLessThanOrEqual(1194);
    // the Heroes popup fits too, with its Start button
    await newGameButton.click();
    const dialog = page.getByRole('dialog', { name: 'Choose your heroes' });
    await dialog.getByRole('button', { name: 'Dwarf', exact: true }).click();
    const start = dialog.getByRole('button', { name: 'Start the quest' });
    const sb = (await start.boundingBox())!;
    expect(sb.y + sb.height).toBeLessThanOrEqual(640);
  });

  test('on a big window the select screen is not blown up: its text is as big as on the play screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.goto('/?nosave=1');
    expect(Number(await page.locator('[data-fit-scale]').getAttribute('data-fit-scale'))).toBe(1);
  });

  test('a tap still lands on the right square when the screen is scaled', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 640 });
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    const scale = await page.locator('[data-fit-scale]').getAttribute('data-fit-scale');
    expect(Number(scale)).toBeLessThan(1);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('125%');
  });

  test('on a wide window the board and the right column stay together in the middle', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 640 });
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    const app = (await page.locator('.app.play').boundingBox())!;
    expect(app.width).toBeGreaterThan(1450); // drawn at the window size, not the tablet size
    expect(app.height).toBeLessThanOrEqual(641);
    // the right column took some of the extra width (up to 420 px)
    const aside = (await page.locator('.app.play aside').boundingBox())!;
    expect(aside.width).toBe(420);
    // the board sits right next to it: no empty strip between them
    const map = (await page.locator('.app.play .map').boundingBox())!;
    expect(Math.abs(map.x + map.width - aside.x)).toBeLessThanOrEqual(1);
    // the pair is centered: the same margin left and right
    const left = map.x;
    const right = app.width - (aside.x + aside.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
    expect(left).toBeGreaterThan(0);
  });
});
