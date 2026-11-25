import { expect, test } from '@playwright/test';
import { dismissStart, openQuest, questCard } from './helpers';

test.describe('the team on the heroes page (decision 38)', () => {
  test('quest 0: warnings never block, a mercenary and the wolf join, and any entry can fall', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openQuest(page, 0, 'frozen-horror');
    const start = page.getByRole('button', { name: 'Start quest' });

    // the pack's alternate Barbarian is offered; the mercenary and ally buttons need a hero first
    await expect(page.getByRole('button', { name: 'Barbarian (alternate)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a mercenary' })).toBeDisabled();

    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    // two heroes in a solo quest: a warning, the start stays on
    await expect(page.getByText('This quest is for one hero.')).toBeVisible();
    await expect(start).toBeEnabled();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await expect(page.getByText('This quest is for one hero.')).toHaveCount(0);

    // the wolf of the quest, and a mercenary of any name
    await page.getByRole('button', { name: /^Snowdasher/ }).click();
    await expect(page.getByRole('button', { name: /^Snowdasher \(Elf\)/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add a mercenary' }).click();
    await page.getByTestId('team-name').fill('Scout');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: /Scout \(Elf\)/ })).toBeVisible();
    await expect(page.getByText('Mercenaries do not play in a solo quest.')).toBeVisible();
    await expect(start).toBeEnabled();
    await page.screenshot({ path: 'test-results/team-popup.png' });
    await start.click();
    // the quest opens with two notes (the story, then the wolf joining)
    await dismissStart(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.veil')).toHaveCount(0);

    // in play: one chip per entry, a tap asks "fell?"
    const chips = page.locator('.hero-chips .chip');
    await expect(chips).toHaveCount(3);
    await chips.filter({ hasText: 'Scout (Elf)' }).click();
    await page.getByRole('button', { name: 'Yes, fell' }).click();
    await expect(chips.filter({ hasText: 'Scout (Elf)' })).toBeDisabled();
    await expect(chips.filter({ hasText: 'Elf' }).first()).toBeEnabled();
  });
});

const RAIMENT = 'campaign-setting-raiment-of-the-frozen-champion';

test.describe('campaigns (decision 37)', () => {
  test('a campaign is made for the pack, remembered, listed, and can be deleted', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await page.getByTestId('home-campaign').click();
    await expect(page.getByText('No saved campaign yet.')).toBeVisible();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    // the heroes of a new campaign
    await expect(page.getByRole('heading', { name: 'Heroes for your campaign' })).toBeVisible();
    await expect(page.getByTestId('mode-hint')).toContainText(
      'Heroes can be changed before each quest',
    );
    await expect(page.getByTestId('start-game')).toBeDisabled();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    // back on the overview: the campaign exists, with its status
    await expect(page.getByRole('heading', { name: 'Campaign 1' })).toBeVisible();
    await expect(page.getByTestId('campaign-progress')).toContainText('0 of 14 quests done');
    await expect(page.locator('.camp-side .card').first()).toContainText('Dwarf');
    await page.screenshot({ path: 'test-results/start-5-campaign-overview.png' });
    // the next quest opens with the team of the campaign, and heroes can be swapped
    await page.getByTestId('play-next').click();
    await expect(page.getByRole('button', { name: 'Dwarf', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Elf', exact: true }).click();
    await page.screenshot({ path: 'test-results/campaign-heroes-per-quest.png' });
    await page.getByTestId('back').click();
    // the list of saved campaigns has it
    await page.getByTestId('back').click();
    await expect(page.getByTestId('campaign-core')).toContainText('Campaign 1');
    await expect(page.getByTestId('campaign-core')).toContainText('Next: Quest 1');
    // delete it: it asks first, and the list is empty after
    await page.getByTestId('delete-campaign-core').click();
    await page.getByTestId('confirm-delete').click();
    await expect(page.getByText('No saved campaign yet.')).toBeVisible();
  });

  test('several campaigns of one pack, each with its own heroes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    for (const hero of ['Dwarf', 'Wizard']) {
      await page.getByTestId('home-campaign').click();
      await page.getByTestId('pack-core').click();
      await page.getByTestId('new-campaign-heroes').click();
      await page.getByRole('button', { name: hero, exact: true }).click();
      await page.getByTestId('start-game').click();
      await dismissStart(page);
      await page.getByRole('button', { name: 'Quests', exact: true }).click();
      await page.getByTestId('back').click();
      await page.getByTestId('back').click();
    }
    await page.getByTestId('home-campaign').click();
    await expect(page.getByTestId('campaign-core')).toContainText('Campaign 1');
    await expect(page.getByTestId('campaign-core-2')).toContainText('Campaign 2');
    await page.getByTestId('campaign-core-2').click();
    await expect(page.locator('.camp-side .card').first()).toContainText('Wizard');
    // a new campaign from the list keeps the others
    await page.getByTestId('back').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await expect(page.getByRole('heading', { name: 'Heroes for your campaign' })).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('campaign-core')).toBeVisible();
    await expect(page.getByTestId('campaign-core-2')).toBeVisible();
  });

  test('an older campaign (one per pack, no name) is read and listed', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'soloquest-campaigns',
        JSON.stringify({
          core: {
            version: 1,
            pack: 'core',
            seed: 5,
            finished: ['q01-the-trial'],
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
    await expect(page.getByTestId('campaign-core').locator('.seg.done')).toHaveCount(1);
    await page.getByTestId('campaign-core').click();
    await expect(page.locator('.camp-side .card').first()).toContainText('Elf');
    await expect(page.getByTestId('quest-done')).toHaveCount(1);
  });
});

test.describe('skipping a quest (decision 101)', () => {
  test('a skipped quest is marked, the next one is offered, and the journal says so', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await expect(page.getByTestId('camp-panel')).toContainText('The Trial');
    await page.getByTestId('skip-quest').click();
    await expect(page.getByTestId('camp-panel')).toContainText('Quest 2');
    await expect(page.locator('.qcard.skipped')).toHaveCount(1);
    await expect(page.locator('.journal')).toContainText('Skipped.');
  });
});

test.describe('settings of a quest and of a campaign (decisions 59, 61, 84)', () => {
  test('a solo quest has the Yeti switch; the Raiment switch is set for the campaign and kept', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await openQuest(page, 0, 'frozen-horror');

    // a single quest has the quest switches and no campaign ones
    await expect(page.getByTestId('solo-no-hug')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId(RAIMENT)).toHaveCount(0);
    // a quest for a group has no Yeti switch
    await page.getByTestId('back').click();
    await questCard(page, 4).click();
    await page.getByTestId('choose-heroes').click();
    await expect(page.getByTestId('solo-no-hug')).toHaveCount(0);

    // a new campaign: the Raiment switch is set before it starts
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-frozen-horror').click();
    await page.getByTestId('new-campaign-heroes').click();
    const raimentOn = page.getByTestId(RAIMENT);
    await expect(raimentOn).toHaveAttribute('aria-checked', 'false');
    await raimentOn.click();
    await expect(raimentOn).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await page.getByTestId('start-game').click();
    await dismissStart(page);

    // in the play header the same switch is on
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Options' }).click();
    const play = page.getByRole('dialog', { name: 'Into the Northlands' });
    await expect(play.getByTestId(RAIMENT)).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: 'test-results/settings-campaign.png' });
    await play.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Quests', exact: true }).click();

    // the campaign remembers it
    await page.getByTestId('campaign-settings').click();
    await expect(page.getByTestId(RAIMENT)).toHaveAttribute('aria-checked', 'true');
  });
});
