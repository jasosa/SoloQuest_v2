import { strToU8, zipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { newGame, openSettings } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const insideDialog = (page: Page) =>
  page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const top = dialogs[dialogs.length - 1];
    return Boolean(top && document.activeElement && top.contains(document.activeElement));
  });

test.describe('dialogs (M8: focus and Escape)', () => {
  test('focus goes into a dialog, Tab stays inside, Escape closes it and focus comes back', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await openSettings(page);
    const link = page.getByTestId('textures-link');
    await link.click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await expect(dlg).toBeVisible();
    expect(await insideDialog(page)).toBe(true);
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await insideDialog(page)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await insideDialog(page)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(link).toBeFocused();
  });

  test('Escape closes only the top dialog, and a preview with unsaved changes ignores it', async ({
    page,
  }) => {
    const manifest = {
      format: 'sqtextures',
      version: 1,
      id: 'esc-pack',
      name: 'Esc pack',
      monster: { orc: 'orc.png' },
    };
    const zipped = Buffer.from(
      zipSync({ 'theme.json': strToU8(JSON.stringify(manifest)), 'orc.png': new Uint8Array(PNG) }),
    );
    await page.goto('/?nosave=1');
    await openSettings(page);
    await page.getByTestId('textures-link').click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg.getByLabel('Texture pack file').setInputFiles({
      name: 'e.sqtextures',
      mimeType: 'application/zip',
      buffer: zipped,
    });
    await dlg.getByTestId('preview-esc-pack').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Esc pack' });
    await expect(prev).toBeVisible();
    // an adjustment is unsaved: Escape must not throw it away
    await prev.locator('[data-slot="monster.orc"]').click();
    await prev.getByRole('button', { name: 'Size: more' }).click();
    await page.keyboard.press('Escape');
    await expect(prev).toBeVisible();
    // reset it: now Escape closes the preview and only the preview
    await prev.getByRole('button', { name: 'Reset this picture' }).click();
    await page.keyboard.press('Escape');
    await expect(prev).toHaveCount(0);
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
  });

  test('the delete campaign dialog closes with Escape and focus goes back to its button', async ({
    page,
  }) => {
    await page.goto('/?nosave=1');
    await page.getByTestId('home-campaign').click();
    await page.getByTestId('pack-core').click();
    await page.getByTestId('new-campaign-heroes').click();
    await newGame(page, ['Elf']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByTestId('back').click();
    await page.getByTestId('delete-campaign-core').click();
    const dlg = page.getByRole('dialog', { name: 'Delete this campaign' });
    await expect(dlg).toBeVisible();
    expect(await insideDialog(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('delete-campaign-core')).toBeFocused();
  });

  test('a margin note closes with Escape', async ({ page }) => {
    await page.goto('/?quest=1&team=dwarf&nosave=1&seed=1');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('[data-door="d1"]').click({ force: true });
    const open = page.getByRole('button', { name: 'Open the door', exact: true });
    await expect(open).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(open).toHaveCount(0);
  });
});

test.describe('quest editor keys', () => {
  async function openQuest1(page: Page) {
    await page.goto('/?editor=1&nosave=1');
    await page.getByRole('button', { name: /^OPEN QUEST/ }).click();
    await page.getByLabel('Bundled quest').selectOption('1');
    await page.getByRole('button', { name: 'Make a copy', exact: true }).click();
    await page.getByRole('button', { name: 'Open it', exact: true }).click();
  }

  test('Backspace on a focused button does not delete the selection; on the board it does', async ({
    page,
  }) => {
    await openQuest1(page);
    const piece = page.locator('[data-furniture="f-table-c"]');
    await piece.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.ed-inspector')).toContainText(/table/i);
    // focus is on a button of the inspector: Backspace belongs to it
    await page.getByRole('button', { name: 'Rotate' }).focus();
    await page.keyboard.press('Backspace');
    await expect(piece).toHaveCount(1);
    // back on the board: Delete removes it
    await piece.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Delete');
    await expect(piece).toHaveCount(0);
  });

  test('while a dialog is open the editor shortcuts do nothing, and Escape closes the dialog', async ({
    page,
  }) => {
    await openQuest1(page);
    // select a piece, then open the import sheet with a bad file
    const piece = page.locator('[data-furniture="f-table-c"]');
    await piece.click({ position: { x: 5, y: 5 } });
    await page.getByLabel('Import file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ nope'),
    });
    const sheet = page.getByRole('dialog', { name: 'The file could not be used' });
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Delete'); // the dialog is open: this must not delete the table
    await expect(piece).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(piece).toHaveCount(1);
  });
});
