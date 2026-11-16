import { expect, test, type Page } from '@playwright/test';

const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);
/** Quest 10 opens with its own start note, "Magic doors". Read it and go on. */
const start = async (page: Page, team: string) => {
  await page.goto(`/?quest=10&team=${team}&nosave=1&seed=1`);
  await expect(page.getByRole('dialog', { name: 'Magic doors' })).toContainText('2 red dice');
  await btn(page, 'Continue').click();
};

test.describe('quest 10: magic doors (decision 67)', () => {
  test('a door never opens: its button asks for the total, again and again', async ({ page }) => {
    await start(page, 'dwarf,elf');
    await door(page, 'd10').click();
    await expect(page.getByRole('dialog', { name: 'A magic door' })).toBeVisible();
    await expect(btn(page, 'Open the door')).toHaveCount(0);
    await btn(page, 'A hero goes through').click();
    await expect(page.getByRole('dialog')).toContainText('Pick the total');
    await btn(page, '3').click();
    await expect(page.locator('[data-door="d1"]')).toHaveCount(1); // R03 is shown, with its door
    // the door is still there for the next hero
    await expect(door(page, 'd10')).toHaveCount(1);
    await door(page, 'd10').click();
    await btn(page, 'A hero goes through').click();
    await expect(page.getByRole('dialog')).toContainText('Pick the total');
  });

  test('leaving by the stairs still shows the note about the gold', async ({ page }) => {
    await start(page, 'dwarf');
    await btn(page, 'End quest').click();
    await btn(page, 'Heroes left by the stairs').click();
    await expect(page.getByText("fool's gold")).toBeVisible();
  });
});
