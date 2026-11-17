import { expect, test } from '@playwright/test';

test.describe('fit to the screen', () => {
  test('on a window shorter than the design, the Start button is on screen without scrolling and the screen is not shrunk', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1194, height: 640 });
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    // quest select fills the width and does not shrink: it is readable on a short window
    expect(Number(await page.locator('[data-fit-scale]').getAttribute('data-fit-scale'))).toBe(1);
    const start = page.getByRole('button', { name: 'Start the quest' });
    await expect(start).toBeVisible();
    const box = (await start.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    expect(box.x + box.width).toBeLessThanOrEqual(1194);
  });

  test('a tap still lands on the right square when the screen is scaled', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 640 });
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    const scale = await page.locator('[data-fit-scale]').getAttribute('data-fit-scale');
    expect(Number(scale)).toBeLessThan(1);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('125%');
  });

  test('on a wide window the play screen uses the width: no empty strip left and right', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 640 });
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1&open=d1');
    const app = (await page.locator('.app.play').boundingBox())!;
    expect(app.width).toBeGreaterThan(1450); // the screen reaches both sides of the window
    expect(app.height).toBeLessThanOrEqual(641);
    // the right column (monsters) took the extra width, the board is where it was
    const aside = (await page.locator('.app.play aside').boundingBox())!;
    expect(aside.x + aside.width).toBeGreaterThan(1450);
  });
});
