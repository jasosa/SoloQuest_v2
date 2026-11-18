import { expect, test } from '@playwright/test';

test('a long margin note stays inside the map and scrolls (bug)', async ({ page }) => {
  // the Polar Warbear note is the tallest: wound and heal, slain, two buttons and its abilities
  await page.goto(
    '/?quest=0&team=dwarf&nosave=1&seed=1&open=in,d1,look@9:9,d2,d3&select=monster:m-bear',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  const box = page.locator('.callout');
  await expect(box).toBeVisible();
  await page.waitForTimeout(400); // the note pops in
  const b = (await box.boundingBox())!;
  const head = (await page.locator('header').first().boundingBox())!;
  const view = page.viewportSize()!;
  expect(b.y).toBeGreaterThanOrEqual(head.y + head.height - 1); // not under the title band
  expect(b.y + b.height).toBeLessThanOrEqual(view.height); // not past the bottom of the screen
  // the buttons are all reachable: the last one can be scrolled into view and tapped
  await box.getByRole('button', { name: 'A hero attacked it' }).scrollIntoViewIfNeeded();
  await expect(box.getByRole('button', { name: 'A hero attacked it' })).toBeVisible();
});
