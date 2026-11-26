import { expect, test, type Page } from '@playwright/test';

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/${name}.png` });
};
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function newQuest(page: Page, title = 'The Cellar') {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^New quest/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
  await expect(page.locator('header.page-head h1')).toHaveText(title);
}

test.describe('editor tabs (the mockup of decision 70)', () => {
  test('the tab bar has Quest, Map, Actions, Monsters and Library; Map is first shown', async ({
    page,
  }) => {
    await newQuest(page);
    await expect(page.getByRole('tab')).toHaveText([
      'Quest',
      'Map',
      'Actions',
      'Monsters',
      'Library',
    ]);
    await expect(tab(page, 'Map')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor-board')).toBeVisible();
    await tab(page, 'Quest').click();
    await expect(tab(page, 'Quest')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor-board')).toHaveCount(0);
    await tab(page, 'Map').click();
    await expect(page.locator('#editor-board')).toBeVisible();
  });

  test('Quest tab: general fields, objectives and rules; no actions card', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Quest').click();
    const general = page.getByTestId('quest-general');
    await general.getByLabel('Title').fill('The Wine Cellar');
    await general.getByLabel('Title').blur();
    await expect(page.locator('header.page-head h1')).toHaveText('The Wine Cellar');
    await general.getByLabel('Summary').fill('The King sends the heroes down.');
    await general.getByLabel('Summary').blur();
    await page.getByRole('button', { name: 'Add an objective' }).click();
    await expect(page.getByTestId('quest-objectives').getByTestId('objective-row')).toHaveCount(1);
    // actions are only in the Actions tab
    await expect(page.getByTestId('quest-actions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add action' })).toHaveCount(0);
    await shot(page, 'tab-quest');
  });

  test('Actions tab lists the actions; a row opens it beside the list', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Actions').click();
    await page.getByTestId('actions-list').getByRole('button', { name: 'Add action' }).click();
    await page.getByRole('button', { name: 'Save action', exact: true }).click();
    await expect(page.getByTestId('actions-list').getByTestId('note-list')).toBeVisible();
    await page
      .getByTestId('actions-list')
      .getByTestId('note-list')
      .getByRole('button')
      .first()
      .click();
    // like the Monsters tab: the action sits in a column, no popup over the list
    await expect(page.getByTestId('action-card')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Action' })).toHaveCount(0);
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
    await card.getByRole('switch', { name: /Special monster/ }).click();
    // a draft: the list has no monster until "Save monster"
    await expect(page.getByTestId('monster-list')).toContainText('No monster yet.');
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
    await card.getByRole('button', { name: 'Save monster' }).click();
    await expect(page.getByTestId('monster-list')).toContainText('Grak');
    await expect(page.getByTestId('monster-list')).toContainText('★');
    await expect(card.getByLabel('Starts')).toHaveValue('dormant');
    await card.getByRole('button', { name: 'Delete monster' }).click();
    await expect(page.getByTestId('monster-list')).toContainText('No monster yet.');
  });

  test('Monsters tab: edits are a draft; Cancel and changing tab drop them; Save is one undo step', async ({
    page,
  }) => {
    await newQuest(page);
    await tab(page, 'Monsters').click();
    await shot(page, 'tab-monsters-empty');
    const list = page.getByTestId('monster-list');
    await list.getByRole('button', { name: 'Add', exact: true }).click();
    const card = page.getByTestId('monster-card');
    await card.getByLabel('Name', { exact: true }).fill('Grak');
    await card.getByLabel('Name', { exact: true }).blur();
    // a new monster has no Delete and no actions until it is saved
    await expect(card.getByRole('button', { name: 'Delete monster' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Save monster' }).click();
    await expect(list).toContainText('Grak');

    // Cancel shows the saved monster again
    await card.getByLabel('Name', { exact: true }).fill('Changed');
    await card.getByLabel('Name', { exact: true }).blur();
    await expect(card.getByTestId('draft-note')).toBeVisible();
    await expect(list).toContainText('Grak');
    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(card.getByLabel('Name', { exact: true })).toHaveValue('Grak');
    await expect(card.getByTestId('draft-note')).toHaveCount(0);

    // changing tab drops the edits
    await card.getByLabel('Name', { exact: true }).fill('Lost');
    await card.getByLabel('Name', { exact: true }).blur();
    await tab(page, 'Quest').click();
    await tab(page, 'Monsters').click();
    await page.getByTestId('monster-list').getByRole('button').first().click();
    await expect(page.getByTestId('monster-card').getByLabel('Name', { exact: true })).toHaveValue(
      'Grak',
    );

    // one Save is one undo step
    await card.getByLabel('Name', { exact: true }).fill('Grak the Bold');
    await card.getByLabel('Name', { exact: true }).blur();
    await card.getByRole('switch', { name: /Special monster/ }).click();
    await card.getByRole('button', { name: 'Save monster' }).click();
    await expect(list).toContainText('Grak the Bold');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(list).toContainText('Grak');
    await expect(list).not.toContainText('Grak the Bold');
    await expect(list).not.toContainText('★');
  });

  test('Monsters tab: waits for and goes toward are prompts; a marked square needs a marker', async ({
    page,
  }) => {
    await newQuest(page);
    await tab(page, 'Monsters').click();
    await page
      .getByTestId('monster-list')
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    await page.getByLabel('Waits for').selectOption('heroInRoom');
    await page.getByLabel('Goes toward').selectOption('strongestHero');
    await expect(page.getByLabel('Waits for')).toHaveValue('heroInRoom');
    await expect(page.getByLabel('Goes toward')).toHaveValue('strongestHero');
    // no marker in the quest: a marked square is refused with a sentence
    await page.getByLabel('Goes toward').selectOption('marker');
    await expect(page.locator('.toast')).toContainText('Pick a marker');
    await expect(page.getByLabel('Goes toward')).toHaveValue('strongestHero');
    await page.getByLabel('Goes toward').selectOption('');
    await page.getByLabel('Waits for').selectOption('');
    await expect(page.getByLabel('Waits for')).toHaveValue('');
  });

  test('Library tab shows the library inside the editor', async ({ page }) => {
    await newQuest(page);
    await tab(page, 'Library').click();
    await expect(page.getByTestId('dz-library')).toContainText('Enemies');
    await page.getByTestId('dz-items').getByRole('button', { name: /^Orc/ }).click();
    await expect(page.getByTestId('dz-card')).toContainText('Enemy: Orc');
    await shot(page, 'tab-designer');
  });
});
