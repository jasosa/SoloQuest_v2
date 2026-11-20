import { expect, test, type Page } from '@playwright/test';
import { dismissStart, openEndSheet } from './helpers';

const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function newQuest(page: Page, title = 'Frozen test') {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^NEW QUEST/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await btn(page, 'Create the quest').click();
  await expect(page.locator('.fr-title')).toHaveText(title);
}

test.describe('editor: Frozen Horror pieces', () => {
  test('an objective with a confirm button made in the editor shows in the playtest', async ({
    page,
  }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const objectives = page.getByTestId('quest-objectives');
    await btn(page, 'Add an objective').click();
    const row = objectives.getByTestId('objective-row').first();
    await row.getByLabel('Confirm button (optional)').fill('The heroes left through the cave');
    await row.getByLabel('Confirm button (optional)').blur();
    // the done rule is a list of general rules, and the confirm button has its own conditions
    await expect(row.getByLabel('Done when')).toBeVisible();
    await expect(row.getByLabel('Add a condition')).toBeVisible();

    await page.getByTestId('playtest').click();
    await dismissStart(page);
    await openEndSheet(page);
    await expect(
      page.getByRole('dialog', { name: 'Goal and ending' }).getByRole('button', {
        name: 'The heroes left through the cave',
      }),
    ).toBeVisible();
  });

  test('wandering monster count, a character and the end text can be set', async ({ page }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page
      .getByRole('group', { name: 'Wandering monster' })
      .getByRole('button', { name: 'A monster' })
      .click();
    const count = page.getByLabel('How many come from a wandering monster trap');
    await count.fill('2');
    await count.blur();
    await expect(count).toHaveValue('2');

    await btn(page, 'Add a character').click();
    await expect(page.getByTestId('pick-bar')).toContainText('where the character appears');
    // click the middle of square 10, 2 of the board
    const box = (await page.locator('#editor-board').boundingBox())!;
    const k = box.width / (26 * 34 + 4);
    await page.mouse.click(box.x + (10.5 * 34 + 2) * k, box.y + (2.5 * 34 + 2) * k);
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const npc = page.getByTestId('npc-row');
    await expect(npc).toHaveCount(1);
    await expect(npc).toContainText('Appears on square 10, 2');
    await npc.getByLabel('Name').fill('Gothar');
    await npc.getByLabel('Name').blur();
    await expect(npc.getByLabel('Name')).toHaveValue('Gothar');

    const end = page.getByLabel('End text');
    await end.fill('Go home.');
    await end.blur();
    await expect(end).toHaveValue('Go home.');
  });

  test('a monster can be attacked-not-fought, passive, and escape is an action trigger', async ({
    page,
  }) => {
    await newQuest(page);
    await page.getByRole('tab', { name: 'Monsters', exact: true }).click();
    await btn(page, 'Add').click();
    await page.getByRole('switch', { name: /Attacked, not fought/ }).click();
    await expect(page.getByRole('switch', { name: /Attacked, not fought/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByLabel('Starts').selectOption('passive');
    await expect(page.getByLabel('Starts')).toHaveValue('passive');
    await page.getByLabel('Attacks per turn').selectOption('2');
    await expect(page.getByLabel('Attacks per turn')).toHaveValue('2');

    await page.getByTestId('monster-card').scrollIntoViewIfNeeded();
    await btn(page, 'Add action').first().click();
    await page.getByLabel('When').selectOption('monsterLeft');
    await expect(page.getByLabel('When')).toHaveValue('monsterLeft');
    await expect(page.getByRole('button', { name: 'Escaped', exact: true })).toBeVisible();
  });
});

test.describe('end sheet of a quest with no objectives', () => {
  test('the goal line still opens the sheet and the stairs button asks once', async ({ page }) => {
    await newQuest(page);
    await page.getByTestId('playtest').click();
    await dismissStart(page);
    const goal = page.getByTestId('goal-line');
    await expect(goal).toContainText('End the quest');
    await goal.click();
    const sheet = page.getByRole('dialog', { name: 'Goal and ending' });
    await expect(sheet.locator('.goals')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Finish the quest' })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Heroes left by the stairs', exact: true }).click();
    await page.getByTestId('end-confirm').click();
    await expect(page.getByRole('dialog')).toContainText('Quest');
  });
});
