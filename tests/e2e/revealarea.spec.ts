import { expect, test } from '@playwright/test';
import { gotoQuest } from './helpers';

const URL = '/?quest=1&team=dwarf&nosave=1&seed=1';

test.describe('Reveal what is here (decision 95)', () => {
  test('there is no side button and no banner', async ({ page }) => {
    await gotoQuest(page, URL);
    await expect(page.getByTestId('show-room-btn')).toHaveCount(0);
    await expect(page.getByText('Show room')).toHaveCount(0);
  });

  test('a fogged room square offers the button; Cancel changes nothing; Reveal shows the room and its note', async ({
    page,
  }) => {
    await gotoQuest(page, URL);
    const monstersBefore = await page.locator('[data-monster]').count();
    const cell = page.locator('[data-fog-cell="7,2"]'); // room R02, the mummy room
    await cell.click();
    await page.getByRole('button', { name: 'Reveal what is here' }).click();
    const card = page.getByRole('dialog', { name: 'Reveal what is here?' });
    await expect(card).toContainText('It shows everything in this room.');

    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('[data-monster]')).toHaveCount(monstersBefore);
    await expect(cell).toHaveCount(1); // still fog

    await page.getByRole('button', { name: 'Reveal what is here' }).click();
    await page
      .getByRole('dialog', { name: 'Reveal what is here?' })
      .getByRole('button', { name: 'Reveal', exact: true })
      .click();
    await expect(page.locator('[data-monster]')).not.toHaveCount(monstersBefore);
    await expect(page.getByText('This mummy is a special guardian')).toBeVisible();
    await expect(cell).toHaveCount(0); // the square is no longer fog
  });

  test('Undo takes the reveal away', async ({ page }) => {
    await gotoQuest(page, URL);
    const monstersBefore = await page.locator('[data-monster]').count();
    await page.locator('[data-fog-cell="7,2"]').click();
    await page.getByRole('button', { name: 'Reveal what is here' }).click();
    await page.getByTestId('reveal-confirm').click();
    await expect(page.locator('[data-monster]')).not.toHaveCount(monstersBefore);
    await page.getByRole('dialog', { name: 'Note C' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
    await expect(page.locator('[data-monster]')).toHaveCount(monstersBefore);
    await expect(page.locator('[data-fog-cell="7,2"]')).toHaveCount(1);
  });

  test('rock and squares already on the map offer nothing', async ({ page }) => {
    await gotoQuest(page, URL);
    await expect(page.locator('[data-fog-cell="2,15"]')).toHaveCount(0); // the start room
    await expect(page.locator('[data-fog-cell="13,0"]')).toHaveCount(0); // rock
  });

  test('a corridor square says what it shows', async ({ page }) => {
    await gotoQuest(page, URL);
    await page.locator('[data-fog-cell="6,18"]').click();
    await page.getByRole('button', { name: 'Reveal what is here' }).click();
    await expect(page.getByRole('dialog', { name: 'Reveal what is here?' })).toContainText(
      'It shows what can be seen from this square.',
    );
  });
});
