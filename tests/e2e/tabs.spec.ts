import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function newQuest(page: Page, title = 'The Cellar') {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^NEW QUEST/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
  await expect(page.locator('.fr-title')).toHaveText(title);
}

test.describe('editor tabs (the mockup of decision 70)', () => {
  test('the tab bar has Quest, Map, Actions, Monsters and Designer; Map is first shown', async ({
    page,
  }) => {
    await newQuest(page);
    await expect(page.getByRole('tab')).toHaveText([
      'Quest',
      'Map',
      'Actions',
      'Monsters',
      'Designer',
    ]);
    await expect(tab(page, 'Map')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor-board')).toBeVisible();
    await tab(page, 'Quest').click();
    await expect(tab(page, 'Quest')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor-board')).toHaveCount(0);
    await tab(page, 'Map').click();
    await expect(page.locator('#editor-board')).toBeVisible();
  });

  test('Quest tab: general fields, objectives, rules and the actions list', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    const general = page.getByTestId('quest-general');
    await general.getByLabel('Title').fill('The Wine Cellar');
    await general.getByLabel('Title').blur();
    await expect(page.locator('.fr-title')).toHaveText('The Wine Cellar');
    await general.getByLabel('Summary').fill('The King sends the heroes down.');
    await general.getByLabel('Summary').blur();
    await page.getByRole('button', { name: 'Add an objective' }).click();
    await expect(page.getByTestId('quest-objectives').getByTestId('objective-row')).toHaveCount(1);
    await expect(page.getByTestId('quest-actions')).toContainText('No action yet.');
    await shot(page, 'tab-quest');
  });

  test('Actions tab lists the actions; a row opens the popup', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    await page.getByTestId('quest-actions').getByRole('button', { name: 'Add action' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await tab(page, 'Actions').click();
    await expect(page.getByTestId('actions-list').getByTestId('note-list')).toBeVisible();
    await page
      .getByTestId('actions-list')
      .getByTestId('note-list')
      .getByRole('button')
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Action' })).toBeVisible();
    await shot(page, 'tab-actions');
  });

  test('Monsters tab: add, edit as enemy fields, behavior, remove', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Monsters').click();
    await expect(page.getByTestId('monster-list')).toContainText('No monster yet.');
    await page
      .getByTestId('monster-list')
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    const card = page.getByTestId('monster-card');
    await expect(card).toBeVisible();
    await card.getByLabel('Name', { exact: true }).fill('Grak');
    await card.getByLabel('Name', { exact: true }).blur();
    await expect(page.getByTestId('monster-list')).toContainText('Grak');
    await card.getByRole('switch', { name: /Special monster/ }).click();
    await expect(page.getByTestId('monster-list')).toContainText('★');
    await card.getByLabel('Type').selectOption('orc');
    await page.getByLabel('Add an ability').selectOption('stone');
    await page.getByRole('button', { name: 'Add', exact: true }).nth(1).click();
    await expect(page.locator('[data-ability="stone"]')).toBeVisible();
    await page.getByLabel('Starts').selectOption('dormant');
    await expect(page.getByLabel('Starts')).toHaveValue('dormant');
    await expect(page.getByRole('switch', { name: /Hidden until/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await shot(page, 'tab-monsters');
    await page
      .getByTestId('monster-list')
      .getByRole('button', { name: 'Remove', exact: true })
      .click();
    await expect(page.getByTestId('monster-list')).toContainText('No monster yet.');
  });

  test('Designer tab shows the library inside the editor', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Designer').click();
    await expect(page.getByTestId('dz-library')).toContainText('Enemies');
    await page.getByTestId('dz-items').getByRole('button', { name: 'Orc', exact: true }).click();
    await expect(page.getByTestId('dz-card')).toContainText('Enemy: Orc');
    await shot(page, 'tab-designer');
  });
});
