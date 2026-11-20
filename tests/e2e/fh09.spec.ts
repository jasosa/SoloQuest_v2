import { expect, test, type Page } from '@playwright/test';
import { gotoQuest, newGame } from './helpers';

// The way from the iron door to the stairway room (R08) of the first map, as the URL replays it.
const PATH = 'in,dh9,dh6,dh4,dh5,dh7';
const URL = `/?quest=fh09-the-heart-of-ice&team=dwarf&nosave=1&seed=1&open=${PATH}`;
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** Read the notes that pop up (a crossing shows the text, then the note of the arrival room). */
async function readNotes(page: Page) {
  for (let i = 0; i < 4; i++) {
    const c = btn(page, 'Continue');
    if (!(await c.isVisible())) break;
    await c.click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Tap the stairway, press its button and answer the question. */
async function useStairs(page: Page, furniture: string, action: string, answer: string) {
  await page.locator(`[data-furniture="${furniture}"]`).first().click();
  await page.locator('.fq').getByRole('button', { name: action }).click();
  await expect(page.getByText('Are all heroes on the stairway?')).toBeVisible();
  await btn(page, answer).click();
}

test.describe('Frozen Horror double quest (quests 9 and 10)', () => {
  test('it is one entry of the Frozen Horror list and says it is the double quest', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-frozen-horror').click();
    const card = page.locator('.qcard', { hasText: 'The Heart of Ice (double quest)' });
    await expect(card).toHaveCount(1);
    await card.click();
    await expect(page.locator('.side h2')).toHaveText('The Heart of Ice (double quest)');
    await newGame(page, ['Dwarf']);
    await page.locator('#board').waitFor();
    await expect(page.locator('header h1')).toHaveText('The Heart of Ice (double quest)');
    await expect(page.locator('header .qn')).toContainText('The Frozen Halls');
  });

  test('?quest=<id> opens it: the iron door, then the stairway and the crossing both ways', async ({
    page,
  }) => {
    await gotoQuest(page, URL.replace(`&open=${PATH}`, ''));
    await expect(page.locator('[data-edge-door="ironEntry"]')).toHaveCount(1);
    await expect(page.locator('[data-monster]')).toHaveCount(0);
    await page.goto(URL);
    await page.locator('#board').waitFor();
    // the start message of the quest and the note of the stairway room: read them
    await btn(page, 'Continue').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // the stairway room is open on the first map
    await expect(page.locator('[data-furniture="f-h-stairs"]')).toHaveCount(1);
    await expect(page.locator('header .qn')).toContainText('The Frozen Halls');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/fh09-halls.png' });

    await useStairs(page, 'f-h-stairs', 'Go down the stairway', 'No, not yet');
    await expect(page.locator('header .qn')).toContainText('The Frozen Halls');

    await useStairs(page, 'f-h-stairs', 'Go down the stairway', 'Yes, all of them');
    await expect(page.getByText('Take every piece of this map off the board')).toBeVisible();
    await readNotes(page);
    await expect(page.locator('header .qn')).toContainText('The Catacombs');
    // the arrival room of the other map shows, with its stairway; nothing of the first map
    await expect(page.locator('[data-furniture="f-c-stairs"]')).toHaveCount(1);
    await expect(page.locator('[data-furniture="f-h-stairs"]')).toHaveCount(0);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/fh09-catacombs.png' });

    // and back up
    await useStairs(page, 'f-c-stairs', 'Go up the stairway', 'Yes, all of them');
    await readNotes(page);
    await expect(page.locator('header .qn')).toContainText('The Frozen Halls');
  });
});
