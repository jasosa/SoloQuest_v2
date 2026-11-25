import AxeBuilder from '@axe-core/playwright';
import { strToU8, zipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { newGame, openQuest, openSettings } from './helpers';

/**
 * Accessibility pass (M8): axe checks WCAG 2.1 A and AA on the main screens and dialogs. Contrast,
 * names of controls, roles and ARIA are covered; keyboard order and focus have their own tests (modal.spec.ts).
 */
async function violations(page: Page): Promise<string[]> {
  await page.waitForTimeout(400); // let animations settle (axe reads the colors it sees)
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return r.violations.map(
    (v) =>
      `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')} ${v.nodes[0]?.html.slice(0, 100)}`,
  );
}

test.describe('accessibility (axe, WCAG 2.1 A and AA)', () => {
  test('the start flow pages, the heroes page and the Textures dialog', async ({ page }) => {
    await page.goto('/?nosave=1');
    expect(await violations(page)).toEqual([]); // Home
    await page.getByTestId('home-single').click();
    expect(await violations(page)).toEqual([]); // single quest, packs
    await page.getByTestId('pack-core').click();
    expect(await violations(page)).toEqual([]); // the pack's quests
    await page.locator('.qcard').first().click();
    await page.getByTestId('choose-heroes').click();
    expect(await violations(page)).toEqual([]); // the heroes of a quest
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('home-campaign').click();
    expect(await violations(page)).toEqual([]); // campaign, packs
    await page.getByTestId('pack-frozen-horror').click();
    await page.getByTestId('new-campaign-heroes').click();
    expect(await violations(page)).toEqual([]); // heroes for the campaign
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await openSettings(page);
    expect(await violations(page)).toEqual([]); // settings
    await page.getByTestId('textures-link').click();
    expect(await violations(page)).toEqual([]);
  });

  test('the campaign overview', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await newGame(page, ['Dwarf']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    expect(await violations(page)).toEqual([]);
  });

  test('play: start card, board, a margin note, the quest sheet, Zargon and the end card', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openQuest(page, 1);
    await newGame(page, ['Dwarf', 'Elf']);
    expect(await violations(page)).toEqual([]); // the start card
    await page.getByRole('button', { name: 'Continue' }).click();
    expect(await violations(page)).toEqual([]); // the board
    await page.locator('[data-door="d1"]').click({ force: true });
    expect(await violations(page)).toEqual([]); // a margin note
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Quest info/ }).click();
    expect(await violations(page)).toEqual([]); // the quest sheet
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Zargon's turn/ }).click();
    expect(await violations(page)).toEqual([]); // Zargon's turn
    await page.keyboard.press('Escape');
    await page.getByTestId('goal-line').click();
    expect(await violations(page)).toEqual([]); // the end sheet
    await page.getByRole('button', { name: 'Leave without finishing', exact: true }).click();
    expect(await violations(page)).toEqual([]); // the confirmation
    await page.getByTestId('end-confirm').click();
    expect(await violations(page)).toEqual([]); // the end card
  });

  test('quest editor: start, every tab, and the dialogs', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    expect(await violations(page)).toEqual([]);
    await page.getByRole('button', { name: /^New quest/ }).click();
    expect(await violations(page)).toEqual([]); // the New quest dialog
    await page.getByLabel('Title').first().fill('Axe quest');
    await page.getByRole('button', { name: 'Create the quest', exact: true }).click();
    for (const tab of ['Map', 'Quest', 'Actions', 'Monsters', 'Library']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      expect(await violations(page), tab).toEqual([]);
    }
    // an action dialog
    await page.getByRole('tab', { name: 'Quest', exact: true }).click();
    await page.getByTestId('quest-actions').getByRole('button', { name: 'Add action' }).click();
    expect(await violations(page)).toEqual([]);
  });

  test('Library popups and a texture pack preview', async ({ page }) => {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^Library/ }).click();
    await page.getByRole('button', { name: /^Enemies/ }).click();
    await page.getByRole('button', { name: 'New enemy' }).click();
    expect(await violations(page)).toEqual([]);
  });

  test('the texture pack dialog and its preview with the knobs', async ({ page }) => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const manifest = {
      format: 'sqtextures',
      version: 1,
      id: 'axe-pack',
      name: 'Axe pack',
      monster: { orc: 'orc.png' },
    };
    const zipped = Buffer.from(
      zipSync({ 'theme.json': strToU8(JSON.stringify(manifest)), 'orc.png': new Uint8Array(png) }),
    );
    await page.goto('/?nosave=1');
    await openSettings(page);
    await page.getByTestId('textures-link').click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles({ name: 'a.sqtextures', mimeType: 'application/zip', buffer: zipped });
    expect(await violations(page)).toEqual([]); // the dialog with a pack in the list
    await dlg.getByTestId('preview-axe-pack').click();
    expect(await violations(page)).toEqual([]); // the preview
    const prev = page.getByRole('dialog', { name: 'Preview: Axe pack' });
    await prev.locator('[data-slot="monster.orc"]').click();
    expect(await violations(page)).toEqual([]); // with the knobs
  });
});
