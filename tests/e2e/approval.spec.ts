import { expect, test, type Page } from '@playwright/test';
import { approveOpenQuest, dismissStart, newGame } from './helpers';

const back = (page: Page) => page.getByRole('button', { name: 'Back', exact: true });
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${name}.png` });
};

/** A new quest the editor accepts: it has one objective with a confirm button. */
async function newReadyQuest(page: Page, title: string) {
  await page.goto('/?editor=1&nosave=1');
  await page.getByRole('button', { name: /^New quest/ }).click();
  await page.getByLabel('Title').first().fill(title);
  await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
  await expect(page.locator('header.page-head h1')).toHaveText(title);
  await page.getByRole('tab', { name: 'Quest', exact: true }).click();
  await page.getByRole('button', { name: 'Add an objective', exact: true }).click();
  const confirm = page.getByLabel('Confirm button (optional)');
  await confirm.fill('The heroes left');
  await confirm.blur();
}

/** From the editor to the box list of Play a quest. */
async function toPlayList(page: Page) {
  await back(page).click();
  await back(page).click();
  await page.getByTestId('home-single').click();
}

/** From Play a quest back to the editor start list. */
async function toEditorStart(page: Page) {
  await back(page).click();
  await page.getByTestId('home-editor').click();
}

test.describe('approved and not approved quests', () => {
  test('a new quest is not in Play a quest until Approve', async ({ page }) => {
    await newReadyQuest(page, 'The Cellar');
    await expect(page.getByTestId('approval-status')).toContainText('Not approved');
    await expect(page.getByTestId('quest-status')).toHaveText('Not approved');
    await shot(page, 'approval-card-draft');
    await back(page).click();
    await expect(page.getByTestId('row-status')).toHaveText('Not approved');
    await shot(page, 'approval-start-list');
    await back(page).click();
    await page.getByTestId('home-single').click();
    await expect(page.getByTestId('pack-mine')).toHaveCount(0);

    await toEditorStart(page);
    await page.getByRole('button', { name: 'Open The Cellar' }).click();
    await approveOpenQuest(page);
    await expect(page.getByTestId('quest-status')).toHaveText('Approved');
    await shot(page, 'approval-card-approved');
    await toPlayList(page);
    await page.getByTestId('pack-mine').click();
    await expect(page.getByRole('button', { name: /The Cellar/ })).toBeVisible();
  });

  test('Withdraw takes the quest out of Play a quest again', async ({ page }) => {
    await newReadyQuest(page, 'The Cellar');
    await approveOpenQuest(page);
    await page.getByTestId('withdraw').click();
    await expect(page.getByTestId('approve')).toBeVisible();
    await expect(page.getByTestId('quest-status')).toHaveText('Not approved');
    await toPlayList(page);
    await expect(page.getByTestId('pack-mine')).toHaveCount(0);
  });

  test('editing an approved quest keeps it approved', async ({ page }) => {
    await newReadyQuest(page, 'The Cellar');
    await approveOpenQuest(page);
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('The Cellar, longer');
    await title.blur();
    await expect(page.getByTestId('quest-status')).toHaveText('Approved');
  });

  test('Approve is refused with the engine error shown inline, no toast', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^New quest/ }).click();
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page.getByTestId('approve').click();
    const error = page.getByTestId('approval-error');
    await expect(error).toContainText('cannot be approved yet');
    await expect(error).toContainText('no objective');
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(page.getByTestId('quest-status')).toHaveText('Not approved');
    await shot(page, 'approval-error');
    // the next change of the quest clears it
    await page.getByRole('button', { name: 'Add an objective', exact: true }).click();
    await expect(error).toHaveCount(0);
  });

  test('a copy of a bundled quest does not replace the original until Replace the original', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^Open quest/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await page.getByRole('button', { name: 'Edit it now', exact: true }).click();
    await expect(page.getByTestId('quest-status')).toHaveText('Not approved');
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    const title = page.getByTestId('quest-general').getByLabel('Title');
    await title.fill('The Trial, mine');
    await title.blur();
    await expect(page.getByTestId('replace-status')).toContainText(
      'Play a quest shows the original',
    );
    await expect(page.getByTestId('replace-original')).toHaveCount(0);
    await approveOpenQuest(page);
    await shot(page, 'approval-card-copy');

    // approved, not replacing: the original stays and the copy is a quest of its own
    await toPlayList(page);
    await page.getByTestId('pack-core').click();
    await expect(page.locator('.qcard .qtitle').first()).toHaveText('The Trial');
    await expect(page.locator('.qcard')).toHaveCount(14);
    await page.getByTestId('pack-mine').click();
    await expect(page.getByRole('button', { name: /The Trial, mine/ })).toBeVisible();

    // Replace the original: the copy plays in its place
    await toEditorStart(page);
    await page.getByRole('button', { name: 'Open The Trial, mine' }).click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page.getByTestId('replace-original').click();
    await expect(page.getByTestId('replace-status')).toContainText('replaces Quest 1');
    await shot(page, 'approval-card-replacing');
    await toPlayList(page);
    await page.getByTestId('pack-core').click();
    await expect(page.locator('.qcard .qtitle').first()).toHaveText('The Trial, mine');

    // Use original puts it back
    await toEditorStart(page);
    await page.getByRole('button', { name: 'Open The Trial, mine' }).click();
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page.getByTestId('use-original').click();
    await expect(page.getByTestId('replace-original')).toBeVisible();
    await toPlayList(page);
    await page.getByTestId('pack-core').click();
    await expect(page.locator('.qcard .qtitle').first()).toHaveText('The Trial');
  });

  test('a quest with a game in progress is edited as a copy; the game and the original stay', async ({
    page,
  }) => {
    await newReadyQuest(page, 'The Cellar');
    await approveOpenQuest(page);
    await toPlayList(page);
    await page.getByTestId('pack-mine').click();
    await page.getByRole('button', { name: /The Cellar/ }).click();
    await page.getByTestId('choose-heroes').click();
    await newGame(page, ['Wizard']);
    await dismissStart(page);
    await page.waitForTimeout(500); // let the autosave finish
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByTestId('home-editor').click();
    await page.getByRole('button', { name: 'Open The Cellar' }).click();
    await expect(page.locator('.toast')).toContainText(
      'This quest has a game in progress. You edit a copy.',
    );
    await expect(page.getByTestId('quest-status')).toHaveText('Not approved');
    await shot(page, 'approval-game-in-progress');
    await back(page).click();
    // the original (approved) and its copy (not approved) are both listed
    await expect(page.getByTestId('row-status')).toHaveText(['Not approved', 'Approved'], {
      ignoreCase: false,
    });
    // the game is still there
    await back(page).click();
    await expect(page.getByTestId('home-continue')).toBeEnabled();
  });
});
