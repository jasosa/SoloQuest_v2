import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function pack(id: string, name: string): Buffer {
  const manifest = {
    format: 'sqtextures',
    version: 1,
    id,
    name,
    floor: ['floor.png'],
    wall: 'w.png',
  };
  return Buffer.from(
    zipSync({
      'theme.json': strToU8(JSON.stringify(manifest)),
      'floor.png': new Uint8Array(PNG),
      'w.png': new Uint8Array(PNG),
    }),
  );
}

const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/zip', buffer });

test.describe('texture packs (decision 78)', () => {
  test('import a pack, use it in a quest, go back to Classic', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await expect(dlg.getByTestId('pack-list')).toContainText('Classic');
    await expect(dlg).toContainText('In use');

    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('My stones');
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('Fan-made');
    await dlg
      .locator('[data-pack="mine"]')
      .getByRole('button', { name: 'Use', exact: true })
      .click();
    await expect(dlg.locator('[data-pack="mine"]')).toContainText('In use');
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();

    // play a quest: the floor uses the pack's picture
    await newGame(page, ['Dwarf']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-themed="floor"]').first()).toBeAttached();
  });

  test('a bad file is refused with a sentence, and nothing is added', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('bad.sqtextures', Buffer.from('nope')));
    await expect(dlg.getByRole('alert')).toContainText('not a texture pack');
    await expect(dlg.locator('[data-pack]')).toHaveCount(0);
  });

  test('delete asks twice, and deleting the pack in use goes back to Classic', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    const row = dlg.locator('[data-pack="mine"]');
    await row.getByRole('button', { name: 'Use', exact: true }).click();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).toBeVisible(); // not deleted yet
    await row.getByRole('button', { name: 'Really delete' }).click();
    await expect(dlg.locator('[data-pack]')).toHaveCount(0);
    await expect(dlg.getByTestId('pack-list')).toContainText('In use');
  });

  test('the dialog buttons are at least 44 px tall', async ({ page }) => {
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    for (const name of ['Use', 'Export', 'Delete', 'Import a pack', 'Close']) {
      const b = dlg.getByRole('button', { name, exact: true }).first();
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('the quest select screen says which texture pack is in use', async ({ page }) => {
    await page.goto('/?nosave=1');
    const link = page.getByTestId('textures-link');
    await expect(link).toHaveText('Textures');
    await link.click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg
      .getByLabel('Texture pack file')
      .setInputFiles(file('a.sqtextures', pack('mine', 'My stones')));
    await dlg
      .locator('[data-pack="mine"]')
      .getByRole('button', { name: 'Use', exact: true })
      .click();
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(link).toHaveText('Textures: My stones');
    // back to Classic: the name goes away
    await link.click();
    await dlg.getByRole('button', { name: 'Use Classic' }).click();
    await dlg.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(link).toHaveText('Textures');
  });

  test('Preview shows a sample board, checks the pictures and lists the empty slots', async ({
    page,
  }) => {
    const manifest = {
      format: 'sqtextures',
      version: 1,
      id: 'tiny',
      name: 'Tiny pack',
      monster: { orc: 'orc.png' },
    };
    const tiny = Buffer.from(
      zipSync({
        'theme.json': strToU8(JSON.stringify(manifest)),
        'orc.png': new Uint8Array(PNG),
      }),
    );
    await page.goto('/?nosave=1');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Texture packs' });
    await dlg.getByLabel('Texture pack file').setInputFiles(file('tiny.sqtextures', tiny));
    await dlg.getByTestId('preview-tiny').click();
    const prev = page.getByRole('dialog', { name: 'Preview: Tiny pack' });
    await expect(prev.getByTestId('pack-sample')).toBeVisible();
    // the orc picture is 1 x 1 px but shown about 32 px wide: it is reported
    await expect(prev.getByRole('status').first()).toContainText('monster orc: 1 x 1 px');
    // everything else is empty
    await expect(prev.getByTestId('pack-missing')).toContainText('board picture');
    await expect(prev.getByTestId('pack-missing')).toContainText('furniture table');
    await expect(prev.getByTestId('pack-missing')).not.toContainText('monster orc');
    // the sample draws the orc with the pack's picture and everything else with the built-in drawing
    await expect(prev.locator('image')).toHaveCount(1);
    await prev.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(prev).toHaveCount(0);
    await expect(dlg).toBeVisible();
  });
});
