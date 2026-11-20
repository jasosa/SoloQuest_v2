import { expect, test } from '@playwright/test';
import { dismissStart } from './helpers';

test.describe('the team in the New game popup (decision 38)', () => {
  test('quest 0: warnings never block, a mercenary and the wolf join, and any entry can fall', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('pack-frozen-horror').click();
    await page.locator('.qcard', { hasText: 'Quest 0' }).click();
    await page.getByTestId('new-game').click();
    const dialog = page.getByRole('dialog', { name: 'Choose your heroes' });
    const start = dialog.getByRole('button', { name: 'Start the quest' });

    // the pack's alternate Barbarian is offered; the mercenary and ally buttons need a hero first
    await expect(dialog.getByRole('button', { name: 'Barbarian (alternate)' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add a mercenary' })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Elf', exact: true }).click();
    await dialog.getByRole('button', { name: 'Dwarf', exact: true }).click();
    // two heroes in a solo quest: a warning, the start stays on
    await expect(dialog.getByText('This quest is for one hero.')).toBeVisible();
    await expect(start).toBeEnabled();
    await dialog.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await expect(dialog.getByText('This quest is for one hero.')).toHaveCount(0);

    // the wolf of the quest, and a mercenary of any name
    await dialog.getByRole('button', { name: /^Snowdasher/ }).click();
    await expect(dialog.getByRole('button', { name: /^Snowdasher \(Elf\)/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Add a mercenary' }).click();
    await dialog.getByTestId('team-name').fill('Scout');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.getByRole('button', { name: /Scout \(Elf\)/ })).toBeVisible();
    await expect(dialog.getByText('Mercenaries do not play in a solo quest.')).toBeVisible();
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

test.describe('campaign or one-shot (decision 37)', () => {
  test('a campaign is made for the pack, remembered, and can be started over', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('soloquest-campaigns'));
    await page.reload();
    await page.getByTestId('new-game').click();
    const dialog = page.getByRole('dialog', { name: 'Choose your heroes' });
    // no campaign yet: a one-shot is the default
    await expect(dialog.getByRole('button', { name: 'One-shot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByTestId('mode-hint')).toContainText('This quest alone');
    await dialog.getByRole('button', { name: 'Campaign' }).click();
    await expect(dialog.getByTestId('mode-hint')).toContainText(
      'A new campaign starts for the core game',
    );
    await dialog.getByRole('button', { name: 'Dwarf', exact: true }).click();
    await dialog.getByRole('button', { name: 'Start the quest' }).click();
    await dismissStart(page);
    await page.getByRole('button', { name: 'Quests' }).click();
    // back on the list: the campaign exists and the next New game opens in campaign mode with the team
    await expect(page.getByTestId('campaign-progress')).toContainText('0 of 14 quests done');
    await page.getByTestId('new-game').click();
    await expect(dialog.getByRole('button', { name: 'Campaign' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByRole('button', { name: 'Dwarf', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: 'test-results/campaign-popup.png' });
    await dialog.getByRole('button', { name: /Keep the saved game|Cancel/ }).click();
    // start over
    await page.getByRole('button', { name: 'Start a new campaign' }).click();
    await page
      .getByRole('dialog', { name: 'Start a new campaign' })
      .getByRole('button', { name: 'Start a new campaign' })
      .click();
    await expect(page.getByTestId('campaign-progress')).toHaveCount(0);
  });
});
