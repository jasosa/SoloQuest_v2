import { expect, test } from '@playwright/test';

// The way to the Crossbowman's room (R18): the path the players take, as the URL replays it.
const PATH =
  'in,look@0:0,look@10:0,look@11:0,look@12:0,look@12:4,look@13:4,look@13:5,look@10:6,look@9:6,look@9:8,look@8:9,look@9:11,d10';
const URL = `/?quest=fh01-xanon-pass&team=barbarian&nosave=1&seed=1&open=${PATH}`;

test.describe('Frozen Horror quest 1', () => {
  test('the Crossbowman is attacked or not: no Slain, no wounds, and an attack makes him surrender', async ({
    page,
  }) => {
    await page.goto(URL);
    // his room is open: pick him
    await page.locator('[data-monster="m-xbow"]').first().click();
    await expect(page.getByTestId('monster-attacked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Slain' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Wound/ })).toHaveCount(0);
    await page.getByTestId('monster-attacked').click();
    await expect(page.getByText('The Crossbowman gives up at once')).toBeVisible();
    await expect(page.locator('[data-monster="m-xbow"]')).toHaveCount(0);
  });
});
