import { expect, test, type Page } from '@playwright/test';
import { closeQuestSheet, gotoQuest, openQuestSheet } from './helpers';

// Development fixture with two maps joined by a stairway (src/engine/quest/testMaps.ts).
const URL = '/?quest=test-maps&team=dwarf&nosave=1&seed=1';
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const door = (page: Page, id: string) => page.locator(`[data-door="${id}"]`);

/** Press a Quest action of the Quest sheet, then answer the question. */
async function crossBy(page: Page, action: string, answer: 'Yes' | 'No') {
  await openQuestSheet(page);
  await btn(page, action).click();
  await expect(page.getByText('Are all heroes on the stairway?')).toBeVisible();
  await btn(page, answer).click();
}

test.describe('a quest with two maps (decision 45)', () => {
  test('the header names the map; "No" stays, "Yes" shows the other map', async ({ page }) => {
    await gotoQuest(page, URL);
    await expect(page.locator('header h1')).toHaveText('Test Maps');
    await expect(page.locator('header .qn')).toContainText('The Upper Hall');
    await expect(page.locator('[data-door="d2"]')).toHaveCount(1);
    await expect(door(page, 'e1')).toHaveCount(0);

    await crossBy(page, 'Go down the stairs', 'No');
    await expect(page.locator('header .qn')).toContainText('The Upper Hall');
    await expect(door(page, 'e1')).toHaveCount(0);

    await crossBy(page, 'Go down the stairs', 'Yes');
    await expect(page.locator('header .qn')).toContainText('The Lower Hall');
    // the arrival room of the other map shows, with its door; nothing of the first map
    await expect(door(page, 'e1')).toHaveCount(1);
    await expect(door(page, 'd2')).toHaveCount(0);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/multimap-lower.png' });

    // and back: the first map is fog again, with its door closed
    await closeQuestSheet(page);
    await crossBy(page, 'Go up the stairs', 'Yes');
    await expect(page.locator('header .qn')).toContainText('The Upper Hall');
    await expect(door(page, 'd2')).toHaveCount(1);
    await expect(door(page, 'e1')).toHaveCount(0);
  });

  test('undo of a crossing goes back to the first map', async ({ page }) => {
    await gotoQuest(page, URL);
    await crossBy(page, 'Go down the stairs', 'Yes');
    await expect(page.locator('header .qn')).toContainText('The Lower Hall');
    await btn(page, 'Undo').click();
    await expect(page.locator('header .qn')).toContainText('The Upper Hall');
    await expect(door(page, 'd2')).toHaveCount(1);
  });
});
