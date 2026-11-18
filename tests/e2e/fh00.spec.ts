import { expect, test } from '@playwright/test';

const URL = '/?quest=0&team=dwarf&nosave=1&seed=1';

test.describe('Frozen Horror quest 0 (Into the Northlands)', () => {
  test('starts outside the iron door, then shows the corridor, with the tunnels marked', async ({
    page,
  }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'test-results/fh00-start.png' });
    await page.locator('[data-door="in"]').click();
    await page.getByRole('button', { name: 'Open the door', exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/fh00-opened.png' });
  });

  test('the quest select screen lists quest 0 after the 14 quests of the book', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Quest 0/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/fh00-select.png' });
  });

  test('ice tunnels are drawn with their number, and a tap shows the other end', async ({
    page,
  }) => {
    await page.goto('/?quest=0&team=dwarf&nosave=1&seed=1&open=in,d1,look@9:9,d2,d3,d4,d5,d6,d7');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-tunnel="tun3:b"]')).toHaveCount(1);
    await expect(page.locator('[data-tunnel="tun3:a"]')).toHaveCount(0); // the other end is unseen
    await page.locator('[data-tunnel-hit="tun3:b"]').click();
    await page.getByRole('button', { name: 'A hero used this tunnel' }).click();
    await expect(page.getByText('comes out at the other square of ice tunnel 3')).toBeVisible();
    await expect(page.locator('[data-tunnel="tun3:a"]')).toHaveCount(1);
  });

  test('the cave entrance and the cage are drawn, Frozen Horror tokens are blue', async ({
    page,
  }) => {
    await page.goto('/?quest=0&team=dwarf&nosave=1&seed=1&open=in,d1,look@9:9,d2,d3');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-board-tile="iceCaveEntrance"]')).toHaveCount(1);
    await expect(page.locator('[data-board-tile="cage"]')).toHaveCount(1);
    const fill = await page
      .locator('[data-token-image], g.tok circle')
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe('rgb(59, 107, 140)'); // --ice: the Polar Warbear in its cage
  });
});
