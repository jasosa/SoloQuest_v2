import { expect, test } from '@playwright/test';
import { dismissStart, newGame, openQuest, questCard } from './helpers';

test.describe('the start flow (Campaign.pptx): six screens', () => {
  test('screens, with their screenshots', async ({ page }) => {
    await page.goto('/?nosave=1');
    // 1. Home: four buttons, Continue is off while there is no saved game
    await expect(page.getByTestId('home-single')).toBeEnabled();
    await expect(page.getByTestId('home-campaign')).toBeEnabled();
    await expect(page.getByTestId('home-continue')).toBeDisabled();
    await expect(page.getByTestId('home-settings')).toBeEnabled();
    await page.screenshot({ path: 'test-results/start-1-home.png' });
    // 2. Single quest: the installed packs and the other missions
    await page.getByTestId('home-single').click();
    await expect(page.getByTestId('pack-core')).toContainText('14 quests');
    await expect(page.getByTestId('pack-frozen-horror')).toContainText('10 quests');
    await expect(page.getByText('Other missions')).toBeVisible();
    await page.screenshot({ path: 'test-results/start-2-single-packs.png' });
    // 3. the pack's quests
    await page.getByTestId('pack-frozen-horror').click();
    await expect(page.getByText('Select the quest to play.')).toBeVisible();
    await page.screenshot({ path: 'test-results/start-3-single-quests.png' });
    await questCard(page, 1).click();
    await expect(page.locator('.side h2')).toHaveText('Xanon Pass');
    await page.screenshot({ path: 'test-results/start-3b-quest-start.png' });
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    // 4. Campaign: packs, and the saved campaigns
    await page.getByTestId('home-campaign').click();
    await expect(page.getByText('Select a quest pack')).toBeVisible();
    await expect(page.getByText('No saved campaign yet.')).toBeVisible();
    await page.screenshot({ path: 'test-results/start-4-campaign-packs.png' });
    // 6. Heroes for a new campaign
    await page.getByTestId('pack-frozen-horror').click();
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
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByTestId('home-single').click();
    await page.getByTestId('pack-core').click();
    await questCard(page, 2).click();
    await page.getByTestId('back').click();
    await expect(page.getByText('Select the quest to play.')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByText('Quest packs')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('back').click();
    await expect(page.getByText('Or continue a saved campaign')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
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
    await expect(page.getByTestId('home-continue')).toBeDisabled();
    // a saved single quest
    await openQuest(page, 1);
    await newGame(page, ['Dwarf']);
    await dismissStart(page);
    await page.waitForTimeout(400); // let the autosave finish
    await page.reload();
    const cont = page.getByTestId('home-continue');
    await expect(cont).toBeEnabled();
    await expect(cont).toContainText('Quest 1, The Trial, turn 1');
    await cont.click();
    await expect(page.locator('header h1')).toHaveText('The Trial');
    // a campaign game made later is the newest: Continue opens it, and leaving goes to its overview
    // a resumed single game leaves to Home
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId('home-continue')).toContainText('Quest 1, The Trial, turn 1');
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
    const mine = page.getByRole('button', { name: /The Cellar/ });
    await expect(mine).toContainText('Made on this device');
    await mine.click();
    await expect(page.locator('.side h2')).toHaveText('The Cellar');
    await newGame(page, ['Wizard']);
    await dismissStart(page);
    await expect(page.locator('header h1')).toHaveText('The Cellar');
  });
});
