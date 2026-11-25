import { expect, test } from '@playwright/test';
import { dismissStart, newGame, openQuest, questCard } from './helpers';

test.describe('the start flow (Campaign.pptx): six screens', () => {
  test('screens, with their screenshots', async ({ page }) => {
    await page.goto('/?nosave=1');
    // 1. Home: four buttons, Continue is off while there is no saved game
    await expect(page.getByTestId('home-single')).toBeEnabled();
    await expect(page.getByTestId('home-campaign')).toBeEnabled();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    await expect(page.getByTestId('home-settings')).toBeEnabled();
    await page.screenshot({ path: 'test-results/start-1-home.png' });
    // 2. Single quest: the installed packs and the other missions
    await page.getByTestId('home-single').click();
    await expect(page.getByTestId('pack-core')).toContainText('14');
    await expect(page.getByTestId('pack-frozen-horror')).toContainText('10');
    await page.screenshot({ path: 'test-results/start-2-single-packs.png' });
    // 3. the pack's quests
    await page.getByTestId('pack-frozen-horror').click();
    await page.screenshot({ path: 'test-results/start-3-single-quests.png' });
    await questCard(page, 1).click();
    await page.getByTestId('choose-heroes').click();
    await expect(page.locator('.side h2')).toHaveText('Xanon Pass');
    await page.screenshot({ path: 'test-results/start-3b-quest-start.png' });
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    // 4. Campaign: packs, and the saved campaigns
    await page.getByTestId('home-campaign').click();
    await expect(page.getByText('New campaign')).toBeVisible();
    await expect(page.getByText('No saved campaign yet.')).toBeVisible();
    await page.screenshot({ path: 'test-results/start-4-campaign-packs.png' });
    // 6. Heroes for a new campaign
    await page.getByTestId('pack-frozen-horror').click();
    await page.getByTestId('new-campaign-heroes').click();
    await expect(page.getByTestId('start-game')).toBeDisabled();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await expect(page.getByTestId('start-game')).toBeEnabled();
    await expect(page.getByTestId('campaign-settings')).toBeVisible();
    await page.screenshot({ path: 'test-results/start-6-campaign-heroes.png' });
    // 5. the overview is shot in team.spec.ts (it needs a campaign)
  });

  test('every page has a Back that goes up one step', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-settings').click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-single')).toBeVisible();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-core').click();
    await questCard(page, 2).click();
    await page.getByTestId('choose-heroes').click();
    await page.getByTestId('back').click();
    await expect(page.getByRole('heading', { name: 'Play a quest' })).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-single')).toBeVisible();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await page.getByTestId('back').click();
    await expect(page.getByText('New campaign')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-single')).toBeVisible();
  });

  test('a single quest makes no campaign, and leaving it returns to the quest page', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openQuest(page, 1);
    await newGame(page, ['Dwarf']);
    await dismissStart(page);
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    // back where it began: the heroes of the quest
    await expect(page.getByTestId('start-game')).toBeVisible();
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('home-campaign').click();
    await expect(page.getByText('No saved campaign yet.')).toBeVisible();
  });

  test('Continue your last game opens the newest saved game, a campaign one on its overview', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    // a saved single quest
    await openQuest(page, 1);
    await newGame(page, ['Dwarf']);
    await dismissStart(page);
    await page.waitForTimeout(400); // let the autosave finish
    await page.reload();
    const cont = page.getByTestId('home-continue');
    await expect(cont).toBeEnabled();
    await expect(page.getByTestId('home-continue-card')).toContainText(
      'Quest 1, The Trial, turn 1',
    );
    await cont.click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    // a campaign game made later is the newest: Continue opens it, and leaving goes to its overview
    // a resumed single game leaves to Home
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId('home-continue-card')).toContainText(
      'Quest 1, The Trial, turn 1',
    );
    await page.getByTestId('home-continue').click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Campaign 1' })).toBeVisible();
    // the overview marks the quest as in progress
    await expect(questCard(page, 1)).toContainText('Saved game');
  });

  test('a quest made in the editor is listed under Other missions and can be played', async ({
    page,
  }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^NEW QUEST/ }).click();
    await page.getByLabel('Title').first().fill('The Cellar');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    await expect(page.locator('.fr-title')).toHaveText('The Cellar');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-mine').click();
    await page.getByRole('button', { name: /The Cellar/ }).click();
    await page.getByTestId('choose-heroes').click();
    await expect(page.locator('.side h2')).toHaveText('The Cellar');
    await newGame(page, ['Wizard']);
    await dismissStart(page);
    await expect(page.locator('header h1')).toHaveText('The Cellar');
  });

  test('heroes for a new campaign never offer Resume for a single game save', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await openQuest(page, 1);
    await newGame(page, ['Dwarf']);
    await dismissStart(page);
    await page.waitForTimeout(400); // let the autosave finish
    await page.reload();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    // the save of quest 1 would be replaced: said so, but not resumed here
    await expect(page.getByTestId('replace-hint')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
  });

  test('deleting a campaign deletes its saved games; a new campaign starts clean', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await expect(questCard(page, 1)).toContainText('Saved game');
    await page.getByTestId('delete-campaign').click();
    await expect(page.getByRole('dialog')).toContainText('saved games');
    await page.getByTestId('confirm-delete').click();
    // no save is left: Continue is off, and a new campaign has no saved game
    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await expect(page.getByTestId('replace-hint')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
  });

  test('Continue skips a save whose campaign is gone', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.waitForTimeout(400);
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
  });

  test('a campaign of a pack that is not installed is listed, disabled, with a Delete link', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'soloquest-campaigns',
        JSON.stringify({
          gone: {
            version: 1,
            id: 'gone',
            name: 'Campaign 1',
            pack: 'gone',
            seed: 1,
            finished: [],
            flags: {},
            team: ['elf'],
            fallen: [],
            settings: {},
          },
        }),
      ),
    );
    await page.reload();
    await page.getByTestId('home-campaign').click();
    await expect(page.getByTestId('campaign-gone')).toBeDisabled();
    await page.getByTestId('delete-campaign-gone').click();
    await expect(page.getByTestId('campaign-gone')).toHaveCount(0);
  });
});
