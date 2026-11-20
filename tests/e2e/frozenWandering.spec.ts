import { expect, test } from '@playwright/test';
import { gotoQuest } from './helpers';

const btn = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog');

// The way to the Crossbowman's room (R18), as in fh01.spec.ts.
const PATH =
  'in,look@0:0,look@10:0,look@11:0,look@12:0,look@12:4,look@13:4,look@13:5,look@10:6,look@9:6,look@9:8,look@8:9,look@9:11,d10';

// Quest 1 has two Skeletons as its wandering monsters: a wandering monster card brings both.
test.describe('Frozen Horror: wandering monster card with a count', () => {
  test('the players enter a square for each monster and both attack the searching hero', async ({
    page,
  }) => {
    await gotoQuest(page, `/?quest=fh01-xanon-pass&team=dwarf,elf&nosave=1&seed=1&open=${PATH}`);
    await page.locator('[data-room-cell="9,13"]').click();
    await btn(page, 'Search for treasure').click();
    await btn(page, 'The room is clear, search anyway').click();
    await btn(page, 'Elf').click();
    await expect(dialog(page)).toContainText('Draw a treasure card');
    await btn(page, 'It was a wandering monster').click();
    await expect(page.getByTestId('pick-banner')).toContainText('1 of 2');
    await page.locator('[data-pick-cell="9,13"]').click();
    await expect(page.getByTestId('pick-banner')).toContainText('2 of 2');
    await page.locator('[data-pick-cell="10,13"]').click();
    await expect(dialog(page)).toContainText('1 of 2');
    await expect(dialog(page)).toContainText('2 of 2');
    await expect(dialog(page)).toContainText('attacks the Elf at once');
    await btn(page, 'Done').click();
    await expect(
      page.locator('.roster li:not(.empty)').filter({ hasText: 'Wandering · next to the Elf' }),
    ).toHaveCount(2);
  });
});
